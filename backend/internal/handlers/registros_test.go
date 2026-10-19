package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/auth"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/db"
)

// TestRegistrosConBase prueba crear y editar registros con la base local y los datos del seed.
// Inicia sesión de verdad (usuarios del seed) y pasa por RequiereSesion, como en producción.
// Usa la célula A-2-18, que no tiene registros, y al terminar borra lo que creó.
// Se saltea si no está DATABASE_URL.
func TestRegistrosConBase(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("falta DATABASE_URL: cargá el .env y corré el seed para probar con la base")
	}
	ctx := context.Background()
	pool, err := db.Conectar(ctx)
	if err != nil {
		t.Fatalf("no se pudo conectar a la base: %v", err)
	}
	t.Cleanup(pool.Close) // se registra primero: los Cleanup corren al revés, así se cierra al final

	a := auth.Nuevo(pool)
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/login", a.Login)
	mux.HandleFunc("POST /api/celulas/{id}/registros", a.RequiereSesion(CrearRegistro(pool)))
	mux.HandleFunc("PUT /api/registros/{id}", a.RequiereSesion(EditarRegistro(pool)))

	// Datos del seed: la célula A-2-18 (sin registros), una célula del lugar B, fotos y un registro viejo.
	var celulaA, celulaB, fotoID, fotoAjena, fotoUsada, registroViejo int64
	err = pool.QueryRow(ctx, `
		SELECT c.id FROM celulas c
		JOIN isletas i ON i.id = c.isleta_id JOIN lugares l ON l.id = i.lugar_id
		WHERE l.letra = 'A' AND i.numero = 2 AND c.numero = 18`).Scan(&celulaA)
	if err != nil {
		t.Fatalf("no se encontró la célula A-2-18 (¿corriste el seed?): %v", err)
	}
	pool.QueryRow(ctx, `
		SELECT c.id FROM celulas c
		JOIN isletas i ON i.id = c.isleta_id JOIN lugares l ON l.id = i.lugar_id
		WHERE l.letra = 'B' LIMIT 1`).Scan(&celulaB)
	// fotoID: una foto que subió el cargador (como pasa en la app, antes de crear el registro).
	err = pool.QueryRow(ctx, `
		INSERT INTO fotos (ruta_r2, subida_por)
		VALUES ('test/registro.jpg', (SELECT id FROM usuarios WHERE email = 'cargador@celulas.test'))
		RETURNING id`).Scan(&fotoID)
	if err != nil {
		t.Fatalf("no se pudo crear la foto de prueba: %v", err)
	}
	// Se registra antes que la limpieza de registros, así corre después (los Cleanup corren al revés).
	t.Cleanup(func() { pool.Exec(ctx, `DELETE FROM fotos WHERE id = $1`, fotoID) })
	// fotoAjena: la subió el admin y no está en ningún registro. fotoUsada: ya está en un registro.
	pool.QueryRow(ctx, `
		SELECT f.id FROM fotos f
		WHERE f.subida_por = (SELECT id FROM usuarios WHERE email = 'admin@celulas.test')
		  AND NOT EXISTS (SELECT 1 FROM registros r WHERE r.foto_id = f.id)
		LIMIT 1`).Scan(&fotoAjena)
	pool.QueryRow(ctx, `SELECT foto_id FROM registros WHERE foto_id IS NOT NULL LIMIT 1`).Scan(&fotoUsada)
	if fotoAjena == 0 || fotoUsada == 0 {
		t.Fatalf("faltan fotos en el seed (ajena %d, usada %d)", fotoAjena, fotoUsada)
	}
	pool.QueryRow(ctx, `
		SELECT r.id FROM registros r
		JOIN celulas c ON c.id = r.celula_id JOIN isletas i ON i.id = c.isleta_id JOIN lugares l ON l.id = i.lugar_id
		WHERE l.letra = 'A' AND NOT r.anulado AND r.periodo < date_trunc('month', now())::date
		LIMIT 1`).Scan(&registroViejo)

	// Limpieza: borra lo que creó este test en A-2-18 (en un test sí se puede borrar).
	borrar := func() {
		pool.Exec(ctx, `DELETE FROM mediciones WHERE registro_id IN (SELECT id FROM registros WHERE celula_id = $1)`, celulaA)
		pool.Exec(ctx, `DELETE FROM registros WHERE celula_id = $1`, celulaA)
	}
	borrar()
	t.Cleanup(borrar)

	// iniciarSesion devuelve la cookie de un usuario del seed.
	iniciarSesion := func(email string) *http.Cookie {
		cuerpo, _ := json.Marshal(map[string]string{"email": email, "contrasena": "bosque1234"})
		respuesta := httptest.NewRecorder()
		mux.ServeHTTP(respuesta, httptest.NewRequest("POST", "/api/login", bytes.NewReader(cuerpo)))
		for _, c := range respuesta.Result().Cookies() {
			if c.Name == auth.NombreCookie {
				return c
			}
		}
		t.Fatalf("no se pudo iniciar sesión con %s (código %d)", email, respuesta.Code)
		return nil
	}
	admin := iniciarSesion("admin@celulas.test")
	cargador := iniciarSesion("cargador@celulas.test")
	lector := iniciarSesion("lector@celulas.test")

	enviar := func(cookie *http.Cookie, metodo, ruta string, cuerpo any) (int, map[string]any) {
		bytesCuerpo, _ := json.Marshal(cuerpo)
		pedido := httptest.NewRequest(metodo, ruta, bytes.NewReader(bytesCuerpo))
		pedido.AddCookie(cookie)
		respuesta := httptest.NewRecorder()
		mux.ServeHTTP(respuesta, pedido)
		var datos map[string]any
		json.Unmarshal(respuesta.Body.Bytes(), &datos)
		return respuesta.Code, datos
	}
	contarMediciones := func(registroID int64) int {
		var n int
		pool.QueryRow(ctx, `SELECT count(*) FROM mediciones WHERE registro_id = $1`, registroID).Scan(&n)
		return n
	}

	hoy := hoyEnCordoba(time.Now()).Format(formatoFecha)
	cuerpoValido := func() map[string]any {
		vivo := func(forma int, altura int) map[string]any {
			return map[string]any{"formaDeVida": forma, "vivo": true, "alturaCm": altura, "flores": 2, "frutos": false, "plantulasNuevas": true}
		}
		return map[string]any{
			"fecha":         hoy,
			"fotoId":        fotoID,
			"observaciones": "  Rebrote  ",
			"polinizadores": 3, // todavía no se guarda: tiene que ignorarse sin error
			"individuos": []any{
				vivo(1, 185), vivo(2, 94),
				map[string]any{"formaDeVida": 3, "vivo": false, "alturaCm": 12}, // muerto: la altura se ignora
				vivo(4, 18),
			},
		}
	}
	rutaCrear := fmt.Sprintf("/api/celulas/%d/registros", celulaA)

	t.Run("lector no puede cargar", func(t *testing.T) {
		if codigo, _ := enviar(lector, "POST", rutaCrear, cuerpoValido()); codigo != http.StatusForbidden {
			t.Errorf("código = %d, se esperaba 403", codigo)
		}
	})
	t.Run("cargador no puede cargar en otro lugar", func(t *testing.T) {
		ruta := fmt.Sprintf("/api/celulas/%d/registros", celulaB)
		if codigo, _ := enviar(cargador, "POST", ruta, cuerpoValido()); codigo != http.StatusForbidden {
			t.Errorf("código = %d, se esperaba 403", codigo)
		}
	})
	t.Run("célula que no existe da 404", func(t *testing.T) {
		if codigo, _ := enviar(admin, "POST", "/api/celulas/999999/registros", cuerpoValido()); codigo != http.StatusNotFound {
			t.Errorf("código = %d, se esperaba 404", codigo)
		}
	})
	t.Run("pedido inválido da 400 y no guarda nada", func(t *testing.T) {
		malo := cuerpoValido()
		malo["fotoId"] = 0
		if codigo, _ := enviar(cargador, "POST", rutaCrear, malo); codigo != http.StatusBadRequest {
			t.Errorf("código = %d, se esperaba 400", codigo)
		}
		var n int
		pool.QueryRow(ctx, `SELECT count(*) FROM registros WHERE celula_id = $1`, celulaA).Scan(&n)
		if n != 0 {
			t.Errorf("había %d registros, se esperaba ninguno", n)
		}
	})
	t.Run("foto que no existe da 400", func(t *testing.T) {
		malo := cuerpoValido()
		malo["fotoId"] = 999999
		if codigo, _ := enviar(cargador, "POST", rutaCrear, malo); codigo != http.StatusBadRequest {
			t.Errorf("código = %d, se esperaba 400", codigo)
		}
	})

	t.Run("cargador no puede usar una foto que subió otro", func(t *testing.T) {
		malo := cuerpoValido()
		malo["fotoId"] = fotoAjena
		if codigo, _ := enviar(cargador, "POST", rutaCrear, malo); codigo != http.StatusBadRequest {
			t.Errorf("código = %d, se esperaba 400", codigo)
		}
	})
	t.Run("ni el admin puede usar una foto que ya está en otro registro", func(t *testing.T) {
		malo := cuerpoValido()
		malo["fotoId"] = fotoUsada
		if codigo, _ := enviar(admin, "POST", rutaCrear, malo); codigo != http.StatusBadRequest {
			t.Errorf("código = %d, se esperaba 400", codigo)
		}
	})

	var registroID int64
	t.Run("cargador guarda un registro válido", func(t *testing.T) {
		codigo, datos := enviar(cargador, "POST", rutaCrear, cuerpoValido())
		if codigo != http.StatusOK {
			t.Fatalf("código = %d (%v), se esperaba 200", codigo, datos)
		}
		registroID = int64(datos["id"].(float64))
		// 4 de "vivo" + 3 individuos vivos x 4 variables = 16. El muerto no guarda nada más.
		if n := contarMediciones(registroID); n != 16 {
			t.Errorf("mediciones = %d, se esperaban 16", n)
		}
		var observaciones string
		var creadoPor, modificadoPor int64
		pool.QueryRow(ctx, `SELECT observaciones, creado_por, modificado_por FROM registros WHERE id = $1`, registroID).
			Scan(&observaciones, &creadoPor, &modificadoPor)
		if observaciones != "Rebrote" || creadoPor != modificadoPor || creadoPor == 0 {
			t.Errorf("observaciones %q, creado_por %d, modificado_por %d", observaciones, creadoPor, modificadoPor)
		}
	})
	t.Run("segundo registro del mismo mes da 409 con el id del existente", func(t *testing.T) {
		codigo, datos := enviar(cargador, "POST", rutaCrear, cuerpoValido())
		if codigo != http.StatusConflict {
			t.Fatalf("código = %d, se esperaba 409", codigo)
		}
		if id, _ := datos["registroId"].(float64); int64(id) != registroID {
			t.Errorf("registroId = %v, se esperaba %d", datos["registroId"], registroID)
		}
	})

	rutaEditar := fmt.Sprintf("/api/registros/%d", registroID)
	t.Run("cargador edita su registro del mes y un vivo pasa a muerto", func(t *testing.T) {
		nuevo := cuerpoValido()
		nuevo["individuos"] = []any{
			map[string]any{"formaDeVida": 1, "vivo": true, "alturaCm": 190, "flores": 0, "frutos": true, "plantulasNuevas": false},
			map[string]any{"formaDeVida": 2, "vivo": false},
			map[string]any{"formaDeVida": 3, "vivo": false},
			map[string]any{"formaDeVida": 4, "vivo": true, "alturaCm": 20, "flores": 1, "frutos": false, "plantulasNuevas": false},
		}
		codigo, datos := enviar(cargador, "PUT", rutaEditar, nuevo)
		if codigo != http.StatusOK {
			t.Fatalf("código = %d (%v), se esperaba 200", codigo, datos)
		}
		// 4 de "vivo" + 2 vivos x 4 variables = 12: las mediciones viejas del arbusto se borraron.
		if n := contarMediciones(registroID); n != 12 {
			t.Errorf("mediciones = %d, se esperaban 12", n)
		}
	})
	t.Run("lector no puede editar", func(t *testing.T) {
		if codigo, _ := enviar(lector, "PUT", rutaEditar, cuerpoValido()); codigo != http.StatusForbidden {
			t.Errorf("código = %d, se esperaba 403", codigo)
		}
	})
	t.Run("cargador no puede editar un mes anterior", func(t *testing.T) {
		ruta := fmt.Sprintf("/api/registros/%d", registroViejo)
		if codigo, _ := enviar(cargador, "PUT", ruta, cuerpoValido()); codigo != http.StatusForbidden {
			t.Errorf("código = %d, se esperaba 403", codigo)
		}
	})
	t.Run("registro que no existe da 404", func(t *testing.T) {
		if codigo, _ := enviar(admin, "PUT", "/api/registros/999999", cuerpoValido()); codigo != http.StatusNotFound {
			t.Errorf("código = %d, se esperaba 404", codigo)
		}
	})
	t.Run("registro anulado no se edita", func(t *testing.T) {
		pool.Exec(ctx, `UPDATE registros SET anulado = true, motivo_anulacion = 'prueba' WHERE id = $1`, registroID)
		defer pool.Exec(ctx, `UPDATE registros SET anulado = false, motivo_anulacion = NULL WHERE id = $1`, registroID)
		if codigo, _ := enviar(admin, "PUT", rutaEditar, cuerpoValido()); codigo != http.StatusBadRequest {
			t.Errorf("código = %d, se esperaba 400", codigo)
		}
	})
}
