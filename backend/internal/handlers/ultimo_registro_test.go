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
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/estados"
)

// Con un id que no es un número, responde 400 antes de tocar la base (por eso el pool puede ser nil).
func TestUltimoRegistroIDInvalido(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/celulas/{id}/ultimo-registro", UltimoRegistro(nil))

	respuesta := httptest.NewRecorder()
	mux.ServeHTTP(respuesta, httptest.NewRequest("GET", "/api/celulas/abc/ultimo-registro", nil))

	if respuesta.Code != http.StatusBadRequest {
		t.Errorf("código = %d, se esperaba %d", respuesta.Code, http.StatusBadRequest)
	}
}

// TestUltimoRegistroConBase usa la base local con los datos de backend/seed/seed.sql.
// Inicia sesión de verdad (usuario lector del seed) y pasa por RequiereSesion.
// Usa la célula A-2-19, que no tiene registros: le crea registros a mano y al terminar los borra.
// Se saltea si no está DATABASE_URL.
func TestUltimoRegistroConBase(t *testing.T) {
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
	mux.HandleFunc("GET /api/celulas/{id}/ultimo-registro", a.RequiereSesion(UltimoRegistro(pool)))

	// Datos del seed: la A-2-19 (sin registros), la C-1-10 (dada de baja) y el admin (para creado_por).
	var celulaID, celulaBaja, adminID, fotoID int64
	err = pool.QueryRow(ctx, `
		SELECT c.id FROM celulas c
		JOIN isletas i ON i.id = c.isleta_id JOIN lugares l ON l.id = i.lugar_id
		WHERE l.letra = 'A' AND i.numero = 2 AND c.numero = 19`).Scan(&celulaID)
	if err != nil {
		t.Fatalf("no se encontró la célula A-2-19 (¿corriste el seed?): %v", err)
	}
	pool.QueryRow(ctx, `
		SELECT c.id FROM celulas c
		JOIN isletas i ON i.id = c.isleta_id JOIN lugares l ON l.id = i.lugar_id
		WHERE l.letra = 'C' AND i.numero = 1 AND c.numero = 10`).Scan(&celulaBaja)
	pool.QueryRow(ctx, `SELECT id FROM usuarios WHERE email = 'admin@celulas.test'`).Scan(&adminID)
	if celulaBaja == 0 || adminID == 0 {
		t.Fatalf("faltan datos del seed (C-1-10 %d, admin %d)", celulaBaja, adminID)
	}

	// Una foto de prueba para los registros (foto_id es obligatorio).
	err = pool.QueryRow(ctx, `
		INSERT INTO fotos (ruta_r2, subida_por) VALUES ('test/ultimo-registro.jpg', $1) RETURNING id`,
		adminID).Scan(&fotoID)
	if err != nil {
		t.Fatalf("no se pudo crear la foto de prueba: %v", err)
	}
	// Se registra antes que la limpieza de registros, así corre después (los Cleanup corren al revés).
	t.Cleanup(func() { pool.Exec(ctx, `DELETE FROM fotos WHERE id = $1`, fotoID) })

	// Limpieza: borra lo que creó este test en la A-2-19 (en un test sí se puede borrar).
	borrar := func() {
		pool.Exec(ctx, `DELETE FROM mediciones WHERE registro_id IN (SELECT id FROM registros WHERE celula_id = $1)`, celulaID)
		pool.Exec(ctx, `DELETE FROM registros WHERE celula_id = $1`, celulaID)
	}
	borrar()
	t.Cleanup(borrar)

	// crearRegistro inserta un registro en la A-2-19 y devuelve su id.
	// La fecha va como texto ("2026-10-15") y el período se calcula en la base.
	crearRegistro := func(fecha string, anulado bool, observaciones *string) int64 {
		var motivo *string
		if anulado {
			m := "Prueba de anulación"
			motivo = &m
		}
		var id int64
		err := pool.QueryRow(ctx, `
			INSERT INTO registros (celula_id, fecha_medicion, periodo, foto_id, observaciones,
			                       anulado, motivo_anulacion, creado_por, modificado_por)
			VALUES ($1, $2::date, date_trunc('month', $2::date)::date, $3, $4, $5, $6, $7, $7)
			RETURNING id`,
			celulaID, fecha, fotoID, observaciones, anulado, motivo, adminID).Scan(&id)
		if err != nil {
			t.Fatalf("no se pudo crear el registro del %s: %v", fecha, err)
		}
		return id
	}
	// medir guarda una medición de un individuo (por forma de vida) en el registro.
	medir := func(registroID int64, forma int, codigo string, valor int) {
		_, err := pool.Exec(ctx, `
			INSERT INTO mediciones (registro_id, variable_id, individuo_id, valor_numerico)
			SELECT $1, v.id, i.id, $5
			FROM variables v, individuos i
			WHERE v.codigo = $4 AND i.celula_id = $2 AND i.forma_de_vida_id = $3`,
			registroID, celulaID, forma, codigo, valor)
		if err != nil {
			t.Fatalf("no se pudo guardar %s de la forma de vida %d: %v", codigo, forma, err)
		}
	}
	// medirCompleto carga los 4 individuos: el de la forma de vida "muerta" solo con vivo = 0 (RN-08).
	// Los vivos tienen flores 0 y frutos/plántulas 0, para comprobar que no desaparecen del JSON.
	medirCompleto := func(registroID int64, altura int, muerta int) {
		for forma := 1; forma <= 4; forma++ {
			if forma == muerta {
				medir(registroID, forma, "vivo", 0)
				continue
			}
			medir(registroID, forma, "vivo", 1)
			medir(registroID, forma, "altura_cm", altura+forma)
			medir(registroID, forma, "flores", 0)
			medir(registroID, forma, "frutos", 0)
			medir(registroID, forma, "plantulas_nuevas", 0)
		}
	}

	// iniciarSesion devuelve la cookie del lector del seed: cualquier rol puede ver este endpoint.
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
	lector := iniciarSesion("lector@celulas.test")

	// pedir hace el GET y devuelve el código y el JSON como map, para poder ver qué claves vinieron.
	pedir := func(cookie *http.Cookie, id int64) (int, map[string]any) {
		pedido := httptest.NewRequest("GET", fmt.Sprintf("/api/celulas/%d/ultimo-registro", id), nil)
		if cookie != nil {
			pedido.AddCookie(cookie)
		}
		respuesta := httptest.NewRecorder()
		mux.ServeHTTP(respuesta, pedido)
		var datos map[string]any
		json.Unmarshal(respuesta.Body.Bytes(), &datos)
		return respuesta.Code, datos
	}

	// revisarIndividuos comprueba que vengan los 4 en orden, que el muerto traiga solo
	// formaDeVida y vivo: false, y que en los vivos flores: 0 y frutos: false sigan apareciendo.
	revisarIndividuos := func(t *testing.T, registro map[string]any, muerta int) {
		t.Helper() // si falla, el error marca la línea de quien la llamó
		individuos, _ := registro["individuos"].([]any)
		if len(individuos) != 4 {
			t.Fatalf("llegaron %d individuos, se esperaban 4", len(individuos))
		}
		for i, crudo := range individuos {
			ind := crudo.(map[string]any)
			// JSON convierte los números a float64 al leerlos en un map.
			if ind["formaDeVida"] != float64(i+1) {
				t.Errorf("individuo %d: formaDeVida = %v, se esperaba %d (orden 1 a 4)", i, ind["formaDeVida"], i+1)
			}
			if i+1 == muerta {
				if len(ind) != 2 || ind["vivo"] != false {
					t.Errorf("individuo muerto: tendría que traer solo formaDeVida y vivo:false, llegó %v", ind)
				}
				continue
			}
			if ind["vivo"] != true {
				t.Errorf("individuo %d: vivo = %v, se esperaba true", i+1, ind["vivo"])
			}
			for _, clave := range []string{"alturaCm", "flores", "frutos", "plantulasNuevas"} {
				if _, esta := ind[clave]; !esta {
					t.Errorf("individuo %d: falta %q en el JSON", i+1, clave)
				}
			}
			if ind["flores"] != float64(0) || ind["frutos"] != false || ind["plantulasNuevas"] != false {
				t.Errorf("individuo %d: flores/frutos/plántulas = %v/%v/%v, se esperaba 0/false/false",
					i+1, ind["flores"], ind["frutos"], ind["plantulasNuevas"])
			}
		}
	}

	periodoActual := estados.PeriodoActual(time.Now())
	periodoAnterior := periodoActual.AddDate(0, -1, 0)
	textoActual := periodoActual.Format("2006-01")
	textoAnterior := periodoAnterior.Format("2006-01")

	t.Run("sin sesión responde 401", func(t *testing.T) {
		if codigo, _ := pedir(nil, celulaID); codigo != http.StatusUnauthorized {
			t.Errorf("código = %d, se esperaba 401", codigo)
		}
	})

	t.Run("célula inexistente responde 404", func(t *testing.T) {
		var inexistente int64
		pool.QueryRow(ctx, `SELECT COALESCE(max(id), 0) + 1000 FROM celulas`).Scan(&inexistente)
		if codigo, _ := pedir(lector, inexistente); codigo != http.StatusNotFound {
			t.Errorf("código = %d, se esperaba 404", codigo)
		}
	})

	t.Run("célula sin registros", func(t *testing.T) {
		codigo, datos := pedir(lector, celulaID)
		if codigo != http.StatusOK {
			t.Fatalf("código = %d, se esperaba 200: %v", codigo, datos)
		}
		celula := datos["celula"].(map[string]any)
		if celula["codigo"] != "A-2-19" || celula["isleta"] != float64(2) || celula["dadaDeBaja"] != false {
			t.Errorf("célula = %v, se esperaba A-2-19, isleta 2, dadaDeBaja false", celula)
		}
		if datos["periodoActual"] != textoActual {
			t.Errorf("periodoActual = %v, se esperaba %s", datos["periodoActual"], textoActual)
		}
		// Las claves tienen que estar, con valor null.
		for _, clave := range []string{"actual", "anterior"} {
			valor, esta := datos[clave]
			if !esta || valor != nil {
				t.Errorf("%s: se esperaba null, llegó %v (¿está la clave? %v)", clave, valor, esta)
			}
		}
	})

	t.Run("trae las 4 formas de vida en orden, con nombre e ícono", func(t *testing.T) {
		_, datos := pedir(lector, celulaID)
		formas, _ := datos["formasDeVida"].([]any)
		if len(formas) != 4 {
			t.Fatalf("llegaron %d formas de vida, se esperaban 4", len(formas))
		}
		// Los nombres se comparan con la tabla, no con texto escrito acá (el de la 3 va a cambiar en T28).
		for i, crudo := range formas {
			forma := crudo.(map[string]any)
			var nombre, icono string
			if err := pool.QueryRow(ctx, `SELECT nombre, icono FROM formas_de_vida WHERE id = $1`, i+1).Scan(&nombre, &icono); err != nil {
				t.Fatalf("no se pudo leer la forma de vida %d: %v", i+1, err)
			}
			if forma["formaDeVida"] != float64(i+1) {
				t.Errorf("posición %d: formaDeVida = %v, se esperaba %d (orden 1 a 4)", i, forma["formaDeVida"], i+1)
			}
			if forma["nombre"] != nombre || forma["icono"] != icono || nombre == "" || icono == "" {
				t.Errorf("forma de vida %d: llegó %v, se esperaba nombre %q e ícono %q", i+1, forma, nombre, icono)
			}
		}
	})

	// El anterior válido es el del día 15 del mes pasado. Además se crean:
	// - uno de hace dos meses (más viejo: no tiene que ganar),
	// - uno anulado del mes pasado con fecha más reciente (RN-12: no tiene que aparecer).
	// Sin observaciones, para comprobar que salen como null.
	crearRegistro(periodoAnterior.AddDate(0, -1, 9).Format("2006-01-02"), false, nil)
	anulado := crearRegistro(periodoAnterior.AddDate(0, 0, 19).Format("2006-01-02"), true, nil)
	medirCompleto(anulado, 50, 0)
	fechaAnterior := periodoAnterior.AddDate(0, 0, 14).Format("2006-01-02")
	anteriorID := crearRegistro(fechaAnterior, false, nil)
	medirCompleto(anteriorID, 100, 3) // la forma de vida 3 está muerta

	t.Run("con registro anterior y un individuo muerto", func(t *testing.T) {
		codigo, datos := pedir(lector, celulaID)
		if codigo != http.StatusOK {
			t.Fatalf("código = %d, se esperaba 200: %v", codigo, datos)
		}
		if datos["actual"] != nil {
			t.Errorf("actual = %v, se esperaba null", datos["actual"])
		}
		anterior, ok := datos["anterior"].(map[string]any)
		if !ok {
			t.Fatalf("anterior = %v, se esperaba un registro", datos["anterior"])
		}
		if anterior["id"] != float64(anteriorID) {
			t.Errorf("anterior.id = %v, se esperaba %d (el anulado y el más viejo no tienen que ganar)", anterior["id"], anteriorID)
		}
		if anterior["fecha"] != fechaAnterior || anterior["periodo"] != textoAnterior {
			t.Errorf("fecha/periodo = %v/%v, se esperaba %s/%s", anterior["fecha"], anterior["periodo"], fechaAnterior, textoAnterior)
		}
		if anterior["fotoId"] != float64(fotoID) {
			t.Errorf("fotoId = %v, se esperaba %d", anterior["fotoId"], fotoID)
		}
		if valor, esta := anterior["observaciones"]; !esta || valor != nil {
			t.Errorf("observaciones: se esperaba null, llegó %v", valor)
		}
		revisarIndividuos(t, anterior, 3)
	})

	// El registro del mes en curso, el día 1 (nunca es una fecha futura), sin muertos y con observaciones.
	observaciones := "Prueba de T14"
	actualID := crearRegistro(periodoActual.Format("2006-01-02"), false, &observaciones)
	medirCompleto(actualID, 120, 0)

	t.Run("con registro del mes en curso", func(t *testing.T) {
		codigo, datos := pedir(lector, celulaID)
		if codigo != http.StatusOK {
			t.Fatalf("código = %d, se esperaba 200: %v", codigo, datos)
		}
		actual, ok := datos["actual"].(map[string]any)
		if !ok {
			t.Fatalf("actual = %v, se esperaba un registro", datos["actual"])
		}
		if actual["id"] != float64(actualID) || actual["periodo"] != textoActual {
			t.Errorf("actual = id %v período %v, se esperaba id %d período %s", actual["id"], actual["periodo"], actualID, textoActual)
		}
		if actual["observaciones"] != observaciones {
			t.Errorf("observaciones = %v, se esperaba %q", actual["observaciones"], observaciones)
		}
		revisarIndividuos(t, actual, 0)
		// El anterior sigue siendo el del mes pasado.
		if anterior, _ := datos["anterior"].(map[string]any); anterior == nil || anterior["id"] != float64(anteriorID) {
			t.Errorf("anterior = %v, se esperaba el registro %d", datos["anterior"], anteriorID)
		}
	})

	t.Run("célula dada de baja igual devuelve los datos", func(t *testing.T) {
		codigo, datos := pedir(lector, celulaBaja)
		if codigo != http.StatusOK {
			t.Fatalf("código = %d, se esperaba 200: %v", codigo, datos)
		}
		celula := datos["celula"].(map[string]any)
		if celula["dadaDeBaja"] != true || celula["codigo"] != "C-1-10" {
			t.Errorf("célula = %v, se esperaba C-1-10 con dadaDeBaja true", celula)
		}
	})
}
