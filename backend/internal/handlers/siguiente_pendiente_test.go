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
func TestSiguientePendienteIDInvalido(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/celulas/{id}/siguiente-pendiente", SiguientePendiente(nil))

	respuesta := httptest.NewRecorder()
	mux.ServeHTTP(respuesta, httptest.NewRequest("GET", "/api/celulas/abc/siguiente-pendiente", nil))

	if respuesta.Code != http.StatusBadRequest {
		t.Errorf("código = %d, se esperaba %d", respuesta.Code, http.StatusBadRequest)
	}
}

// TestSiguientePendienteConBase arma sus propios datos para no depender del seed ni del mes:
// un lugar de prueba con dos isletas, y en cada célula los registros justos para que tenga el
// estado que el caso necesita. Al terminar borra todo (en un test sí se puede borrar).
//
//	Isleta 1: 1 al día · 2 pendiente · 3 dada de baja · 4 sin registro inicial · 5 al día
//	Isleta 2: 1 sin registro inicial · 2 dada de baja   (la 2 repite el número de la isleta 1)
//
// Se saltea si no está DATABASE_URL.
func TestSiguientePendienteConBase(t *testing.T) {
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
	mux.HandleFunc("GET /api/celulas/{id}/siguiente-pendiente", a.RequiereSesion(SiguientePendiente(pool)))

	var adminID int64
	if err := pool.QueryRow(ctx, `SELECT id FROM usuarios WHERE email = 'admin@celulas.test'`).Scan(&adminID); err != nil {
		t.Fatalf("no se encontró el admin del seed (¿corriste el seed?): %v", err)
	}

	// ---------- Datos de prueba ----------

	// Un lugar propio, con la primera letra libre empezando por la Z (así no choca con el seed).
	var letra string
	err = pool.QueryRow(ctx, `
		SELECT l FROM unnest(string_to_array('ZYXWVUTSRQPONMLKJIHGFEDCBA', NULL)) AS l
		WHERE NOT EXISTS (SELECT 1 FROM lugares WHERE letra = l)
		LIMIT 1`).Scan(&letra)
	if err != nil {
		t.Fatalf("no queda ninguna letra libre para el lugar de prueba: %v", err)
	}
	var lugarID, fotoID int64
	if err := pool.QueryRow(ctx, `
		INSERT INTO lugares (letra, nombre, tipo) VALUES ($1, 'Lugar de prueba T14', 'colegio') RETURNING id`,
		letra).Scan(&lugarID); err != nil {
		t.Fatalf("no se pudo crear el lugar de prueba: %v", err)
	}
	if err := pool.QueryRow(ctx, `
		INSERT INTO fotos (ruta_r2, subida_por) VALUES ('test/siguiente-pendiente.jpg', $1) RETURNING id`,
		adminID).Scan(&fotoID); err != nil {
		t.Fatalf("no se pudo crear la foto de prueba: %v", err)
	}
	// Limpieza en orden inverso a las claves foráneas: registros → células → isletas → lugar y foto.
	t.Cleanup(func() {
		pool.Exec(ctx, `DELETE FROM registros WHERE celula_id IN (
			SELECT c.id FROM celulas c JOIN isletas i ON i.id = c.isleta_id WHERE i.lugar_id = $1)`, lugarID)
		pool.Exec(ctx, `DELETE FROM celulas WHERE isleta_id IN (SELECT id FROM isletas WHERE lugar_id = $1)`, lugarID)
		pool.Exec(ctx, `DELETE FROM isletas WHERE lugar_id = $1`, lugarID)
		pool.Exec(ctx, `DELETE FROM lugares WHERE id = $1`, lugarID)
		pool.Exec(ctx, `DELETE FROM fotos WHERE id = $1`, fotoID)
	})

	periodoActual := estados.PeriodoActual(time.Now())
	fechaEsteMes := periodoActual.Format("2006-01-02")                        // día 1: nunca es futuro
	fechaMesAnterior := periodoActual.AddDate(0, -1, 14).Format("2006-01-02") // día 15 del mes pasado
	plantacion := periodoActual.AddDate(0, -2, 0).Format("2006-01-02")

	crearIsleta := func(numero int) int64 {
		var id int64
		if err := pool.QueryRow(ctx, `
			INSERT INTO isletas (lugar_id, numero, filas, columnas) VALUES ($1, $2, 1, 10) RETURNING id`,
			lugarID, numero).Scan(&id); err != nil {
			t.Fatalf("no se pudo crear la isleta %d: %v", numero, err)
		}
		return id
	}
	// crearCelula crea la célula con los registros que necesita su estado.
	// (No se crean individuos: el estado y este endpoint no los usan.)
	crearCelula := func(isletaID int64, numero int, estado string) int64 {
		var id int64
		if err := pool.QueryRow(ctx, `
			INSERT INTO celulas (isleta_id, numero, fila, columna, fecha_plantacion, creado_por, modificado_por)
			VALUES ($1, $2, 1, $2, $3::date, $4, $4) RETURNING id`,
			isletaID, numero, plantacion, adminID).Scan(&id); err != nil {
			t.Fatalf("no se pudo crear la célula %d: %v", numero, err)
		}
		registro := func(fecha string) {
			if _, err := pool.Exec(ctx, `
				INSERT INTO registros (celula_id, fecha_medicion, periodo, foto_id, creado_por, modificado_por)
				VALUES ($1, $2::date, date_trunc('month', $2::date)::date, $3, $4, $4)`,
				id, fecha, fotoID, adminID); err != nil {
				t.Fatalf("no se pudo crear el registro de la célula %d: %v", numero, err)
			}
		}
		switch estado {
		case estados.AlDia:
			registro(fechaEsteMes)
		case estados.Pendiente:
			registro(fechaMesAnterior)
		case estados.Baja:
			if _, err := pool.Exec(ctx, `
				UPDATE celulas SET estado = 'baja', motivo_baja = 'Prueba', fecha_baja = $2::date WHERE id = $1`,
				id, fechaEsteMes); err != nil {
				t.Fatalf("no se pudo dar de baja la célula %d: %v", numero, err)
			}
		}
		return id // estados.SinRegistro: sin ningún registro
	}

	isleta1 := crearIsleta(1)
	alDia1 := crearCelula(isleta1, 1, estados.AlDia)
	pendiente2 := crearCelula(isleta1, 2, estados.Pendiente)
	crearCelula(isleta1, 3, estados.Baja)
	sinRegistro4 := crearCelula(isleta1, 4, estados.SinRegistro)
	alDia5 := crearCelula(isleta1, 5, estados.AlDia)

	isleta2 := crearIsleta(2)
	sola1 := crearCelula(isleta2, 1, estados.SinRegistro)
	crearCelula(isleta2, 2, estados.Baja)

	// Antes de probar el endpoint, se confirma que las células quedaron con el estado buscado.
	// Si esto falla, el problema está en los datos de prueba, no en el endpoint.
	estadoDe, err := estados.DeCelulas(ctx, pool, []int64{alDia1, pendiente2, sinRegistro4, alDia5, sola1}, periodoActual)
	if err != nil {
		t.Fatalf("no se pudieron calcular los estados de prueba: %v", err)
	}
	for id, esperado := range map[int64]string{
		alDia1: estados.AlDia, pendiente2: estados.Pendiente, sinRegistro4: estados.SinRegistro,
		alDia5: estados.AlDia, sola1: estados.SinRegistro,
	} {
		if estadoDe[id] != esperado {
			t.Fatalf("la célula %d quedó %q, se esperaba %q", id, estadoDe[id], esperado)
		}
	}

	// ---------- Pedidos ----------

	cuerpo, _ := json.Marshal(map[string]string{"email": "lector@celulas.test", "contrasena": "bosque1234"})
	respuestaLogin := httptest.NewRecorder()
	mux.ServeHTTP(respuestaLogin, httptest.NewRequest("POST", "/api/login", bytes.NewReader(cuerpo)))
	var lector *http.Cookie
	for _, c := range respuestaLogin.Result().Cookies() {
		if c.Name == auth.NombreCookie {
			lector = c
		}
	}
	if lector == nil {
		t.Fatalf("no se pudo iniciar sesión con el lector (código %d)", respuestaLogin.Code)
	}

	// pedir devuelve el código y la respuesta ya leída.
	pedir := func(cookie *http.Cookie, id int64) (int, map[string]any) {
		pedido := httptest.NewRequest("GET", fmt.Sprintf("/api/celulas/%d/siguiente-pendiente", id), nil)
		if cookie != nil {
			pedido.AddCookie(cookie)
		}
		respuesta := httptest.NewRecorder()
		mux.ServeHTTP(respuesta, pedido)
		var datos map[string]any
		json.Unmarshal(respuesta.Body.Bytes(), &datos)
		return respuesta.Code, datos
	}
	// revisar comprueba que desde la célula "desde" la siguiente sea "esperada" (0 = null).
	revisar := func(t *testing.T, desde, esperada int64, codigoEsperado string) {
		t.Helper()
		codigo, datos := pedir(lector, desde)
		if codigo != http.StatusOK {
			t.Fatalf("código = %d, se esperaba 200: %v", codigo, datos)
		}
		valor, esta := datos["celula"]
		if !esta {
			t.Fatalf("falta la clave \"celula\" en %v", datos)
		}
		if esperada == 0 {
			if valor != nil {
				t.Errorf("celula = %v, se esperaba null", valor)
			}
			return
		}
		celula, _ := valor.(map[string]any)
		if celula == nil || celula["id"] != float64(esperada) || celula["codigo"] != codigoEsperado {
			t.Errorf("celula = %v, se esperaba id %d y código %s", valor, esperada, codigoEsperado)
		}
		if celula != nil && celula["id"] == float64(desde) {
			t.Errorf("devolvió la misma célula desde la que se pidió")
		}
	}
	codigo := func(isleta, numero int) string { return fmt.Sprintf("%s-%d-%d", letra, isleta, numero) }

	t.Run("hay una siguiente con número mayor", func(t *testing.T) {
		revisar(t, alDia1, pendiente2, codigo(1, 2))
	})
	t.Run("saltea la dada de baja y la actual", func(t *testing.T) {
		// Desde la 2 (pendiente): no se devuelve a sí misma, la 3 está de baja, sigue la 4.
		revisar(t, pendiente2, sinRegistro4, codigo(1, 4))
	})
	t.Run("sin mayores pendientes, vuelve al principio", func(t *testing.T) {
		// Desde la 4: la 5 está al día, así que vuelve a la 2.
		revisar(t, sinRegistro4, pendiente2, codigo(1, 2))
		// Desde la 5 (la última): también vuelve a la 2.
		revisar(t, alDia5, pendiente2, codigo(1, 2))
	})
	t.Run("ignora otra isleta con el mismo número", func(t *testing.T) {
		// En la isleta 2, la única otra célula (la 2) está de baja. La 2 de la isleta 1 está
		// pendiente y tiene el mismo número, pero es de otra isleta: no cuenta.
		revisar(t, sola1, 0, "")
	})

	t.Run("célula inexistente responde 404", func(t *testing.T) {
		var inexistente int64
		pool.QueryRow(ctx, `SELECT COALESCE(max(id), 0) + 1000 FROM celulas`).Scan(&inexistente)
		if codigo, _ := pedir(lector, inexistente); codigo != http.StatusNotFound {
			t.Errorf("código = %d, se esperaba 404", codigo)
		}
	})
	t.Run("lugar deshabilitado responde 404", func(t *testing.T) {
		if _, err := pool.Exec(ctx, `UPDATE lugares SET activo = false WHERE id = $1`, lugarID); err != nil {
			t.Fatalf("no se pudo deshabilitar el lugar de prueba: %v", err)
		}
		defer pool.Exec(ctx, `UPDATE lugares SET activo = true WHERE id = $1`, lugarID)
		if codigo, _ := pedir(lector, alDia1); codigo != http.StatusNotFound {
			t.Errorf("código = %d, se esperaba 404", codigo)
		}
	})
	t.Run("sin sesión responde 401", func(t *testing.T) {
		if codigo, _ := pedir(nil, alDia1); codigo != http.StatusUnauthorized {
			t.Errorf("código = %d, se esperaba 401", codigo)
		}
	})
}
