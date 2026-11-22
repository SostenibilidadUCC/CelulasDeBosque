package handlers

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/auth"
)

// Tests de POST /api/celulas (T17, ALT-01 a ALT-05). Usan la base de desarrollo (DATABASE_URL) y el
// entorno de los tests de administración: lugares de prueba X, Y, Z (se borran al empezar y al
// terminar) y las sesiones del admin, el cargador (lugar A) y el lector del seed.

// isletaPruebaEnA es el número de una isleta de prueba en el lugar A del seed, para probar al
// cargador en su propio lugar. El seed no usa números tan altos.
const isletaPruebaEnA = 99

// nuevoEntornoAltaCelula arma el entorno de admin y le suma la ruta de este handler.
func nuevoEntornoAltaCelula(t *testing.T) *entornoAdmin {
	t.Helper()
	e := nuevoEntornoAdmin(t)
	// Otro auth.Nuevo sobre la misma base: las sesiones están en la tabla sesiones, así que las
	// cookies del entorno sirven igual.
	e.mux.HandleFunc("POST /api/celulas", auth.Nuevo(e.pool).RequiereSesion(AltaCelula(e.pool)))
	return e
}

// isletaDePruebaEnA crea la isleta 99 en el lugar A (el del cargador del seed) y la borra al
// terminar, con sus células e individuos. borrarLugaresPrueba no la toca porque A no es de prueba.
func (e *entornoAdmin) isletaDePruebaEnA(t *testing.T, filas, columnas int) int64 {
	t.Helper()
	ctx := context.Background()
	borrar := func() {
		e.pool.Exec(ctx, `DELETE FROM individuos WHERE celula_id IN (
			SELECT c.id FROM celulas c JOIN isletas i ON i.id = c.isleta_id JOIN lugares l ON l.id = i.lugar_id
			WHERE l.letra = 'A' AND i.numero = $1)`, isletaPruebaEnA)
		e.pool.Exec(ctx, `DELETE FROM celulas WHERE isleta_id IN (
			SELECT i.id FROM isletas i JOIN lugares l ON l.id = i.lugar_id WHERE l.letra = 'A' AND i.numero = $1)`, isletaPruebaEnA)
		e.pool.Exec(ctx, `DELETE FROM isletas WHERE numero = $1 AND lugar_id = (SELECT id FROM lugares WHERE letra = 'A')`, isletaPruebaEnA)
	}
	borrar() // por si quedó de una corrida que se cortó
	t.Cleanup(borrar)
	return e.crearIsletaPrueba(t, e.idDeLetra(t, "A"), isletaPruebaEnA, filas, columnas)
}

func TestAltaCelula(t *testing.T) {
	e := nuevoEntornoAltaCelula(t)
	idX := e.crearLugarPrueba(t, "X")
	isleta := e.crearIsletaPrueba(t, idX, 1, 3, 4) // 3 filas × 4 columnas, sin foto del plano
	e.crearCelulaPrueba(t, isleta, 7, 2, 2)        // la célula 7 ya ocupa la fila 2, columna 2

	alta := func(numero, fila, columna int, fecha string) map[string]any {
		cuerpo := map[string]any{"isletaId": isleta, "numero": numero, "fila": fila, "columna": columna}
		if fecha != "" {
			cuerpo["fechaPlantacion"] = fecha
		}
		return cuerpo
	}

	t.Run("el admin crea la célula con sus 4 individuos (201)", func(t *testing.T) {
		codigo, datos := pedir(e.mux, e.admin, "POST", "/api/celulas", alta(61, 1, 3, "2026-11-02"))
		if codigo != http.StatusCreated {
			t.Fatalf("código = %d, se esperaba 201. Cuerpo: %v", codigo, datos)
		}
		if datos["codigo"] != "X-1-61" || datos["isletaId"] != float64(isleta) || datos["numero"] != float64(61) ||
			datos["fila"] != float64(1) || datos["columna"] != float64(3) || datos["fechaPlantacion"] != "2026-11-02" {
			t.Errorf("respuesta = %v", datos)
		}
		if id, _ := datos["id"].(float64); id <= 0 {
			t.Errorf("falta el id: %v", datos)
		}
		c, ok := e.celulasEnBase(t, isleta)[61]
		if !ok {
			t.Fatal("la célula 61 no quedó en la base")
		}
		if c.fila != 1 || c.columna != 3 || c.fecha != "2026-11-02" || !c.creadaPorAdmin {
			t.Errorf("célula guardada como %+v", c)
		}
		if fmt.Sprint(c.formas) != "[1 2 3 4]" {
			t.Errorf("individuos de las formas %v, se esperaban [1 2 3 4] (RN-01)", c.formas)
		}
	})

	t.Run("sin fecha de plantación se usa hoy en hora de Córdoba (ALT-04)", func(t *testing.T) {
		codigo, datos := pedir(e.mux, e.admin, "POST", "/api/celulas", alta(62, 1, 4, ""))
		if codigo != http.StatusCreated {
			t.Fatalf("código = %d, se esperaba 201. Cuerpo: %v", codigo, datos)
		}
		hoy := hoyEnCordoba(time.Now()).Format("2006-01-02")
		if datos["fechaPlantacion"] != hoy {
			t.Errorf("fechaPlantacion = %v, se esperaba %s", datos["fechaPlantacion"], hoy)
		}
	})

	t.Run("número repetido en la isleta: 409", func(t *testing.T) {
		codigo, datos := pedir(e.mux, e.admin, "POST", "/api/celulas", alta(7, 3, 1, ""))
		if codigo != http.StatusConflict || datos["error"] != "Ya existe una célula con ese número en la isleta." {
			t.Errorf("código = %d, cuerpo = %v; se esperaba 409 por número repetido", codigo, datos)
		}
	})

	t.Run("celda ocupada: 409", func(t *testing.T) {
		codigo, datos := pedir(e.mux, e.admin, "POST", "/api/celulas", alta(8, 2, 2, ""))
		if codigo != http.StatusConflict || datos["error"] != "Esa celda del plano ya está ocupada." {
			t.Errorf("código = %d, cuerpo = %v; se esperaba 409 por celda ocupada", codigo, datos)
		}
	})

	t.Run("datos inválidos: 400 y no se crea nada", func(t *testing.T) {
		manana := hoyEnCordoba(time.Now()).AddDate(0, 0, 1).Format("2006-01-02")
		casos := []struct {
			nombre  string
			cuerpo  map[string]any
			mensaje string
		}{
			{"fila mayor que la grilla", alta(20, 4, 1, ""), "La fila tiene que ser de 1 a 3"},
			{"fila 0", alta(20, 0, 1, ""), "La fila tiene que ser de 1 a 3"},
			{"columna mayor que la grilla", alta(20, 1, 5, ""), "La columna tiene que ser de 1 a 4"},
			{"columna 0", alta(20, 1, 0, ""), "La columna tiene que ser de 1 a 4"},
			{"fecha futura (mañana en Córdoba)", alta(20, 3, 3, manana), "La fecha de plantación no puede ser futura"},
			{"fecha con otro formato", alta(20, 3, 3, "02/11/2026"), "Elegí la fecha de plantación"},
			{"número 0", alta(0, 3, 3, ""), "El número de célula tiene que ser de 1 a 200"},
			{"número 201", alta(201, 3, 3, ""), "El número de célula tiene que ser de 1 a 200"},
			{"sin isleta", map[string]any{"numero": 20, "fila": 3, "columna": 3}, "Elegí la isleta"},
		}
		for _, caso := range casos {
			codigo, datos := pedir(e.mux, e.admin, "POST", "/api/celulas", caso.cuerpo)
			if codigo != http.StatusBadRequest || datos["error"] != caso.mensaje {
				t.Errorf("%s: código = %d, cuerpo = %v; se esperaba 400 %q", caso.nombre, codigo, datos, caso.mensaje)
			}
		}
		if _, existe := e.celulasEnBase(t, isleta)[20]; existe {
			t.Error("se creó la célula 20 con datos inválidos")
		}
	})

	t.Run("JSON roto: 400", func(t *testing.T) {
		pedido := httptest.NewRequest("POST", "/api/celulas", bytes.NewReader([]byte(`{"isletaId": `)))
		pedido.AddCookie(e.admin)
		respuesta := httptest.NewRecorder()
		e.mux.ServeHTTP(respuesta, pedido)
		if respuesta.Code != http.StatusBadRequest {
			t.Errorf("código = %d, se esperaba 400", respuesta.Code)
		}
	})

	t.Run("lector y cargador de otro lugar: 403 y no se crea nada", func(t *testing.T) {
		for nombre, cookie := range map[string]*http.Cookie{"lector": e.lector, "cargador de A en el lugar X": e.cargador} {
			codigo, datos := pedir(e.mux, cookie, "POST", "/api/celulas", alta(30, 3, 2, ""))
			if codigo != http.StatusForbidden {
				t.Errorf("%s: código = %d, cuerpo = %v; se esperaba 403", nombre, codigo, datos)
			}
		}
		if _, existe := e.celulasEnBase(t, isleta)[30]; existe {
			t.Error("se creó la célula 30 sin permiso")
		}
	})

	t.Run("sin sesión: 401", func(t *testing.T) {
		if codigo, _ := pedir(e.mux, nil, "POST", "/api/celulas", alta(31, 3, 2, "")); codigo != http.StatusUnauthorized {
			t.Errorf("código = %d, se esperaba 401", codigo)
		}
	})

	t.Run("isleta inexistente: 404", func(t *testing.T) {
		cuerpo := map[string]any{"isletaId": 999999999, "numero": 1, "fila": 1, "columna": 1}
		codigo, datos := pedir(e.mux, e.admin, "POST", "/api/celulas", cuerpo)
		if codigo != http.StatusNotFound || datos["error"] != "La isleta no existe" {
			t.Errorf("código = %d, cuerpo = %v; se esperaba 404", codigo, datos)
		}
	})

	t.Run("lugar deshabilitado: 404", func(t *testing.T) {
		idY := e.crearLugarPrueba(t, "Y")
		isletaY := e.crearIsletaPrueba(t, idY, 1, 2, 2)
		if _, err := e.pool.Exec(context.Background(), `UPDATE lugares SET activo = false WHERE id = $1`, idY); err != nil {
			t.Fatalf("no se pudo deshabilitar el lugar: %v", err)
		}
		cuerpo := map[string]any{"isletaId": isletaY, "numero": 1, "fila": 1, "columna": 1}
		codigo, datos := pedir(e.mux, e.admin, "POST", "/api/celulas", cuerpo)
		if codigo != http.StatusNotFound {
			t.Errorf("código = %d, cuerpo = %v; se esperaba 404", codigo, datos)
		}
		if n := len(e.celulasEnBase(t, isletaY)); n != 0 {
			t.Errorf("la isleta del lugar deshabilitado tiene %d células", n)
		}
	})

	t.Run("el cargador crea células en su propio lugar (201)", func(t *testing.T) {
		isletaA := e.isletaDePruebaEnA(t, 2, 2)
		cuerpo := map[string]any{"isletaId": isletaA, "numero": 61, "fila": 2, "columna": 1}
		codigo, datos := pedir(e.mux, e.cargador, "POST", "/api/celulas", cuerpo)
		if codigo != http.StatusCreated {
			t.Fatalf("código = %d, se esperaba 201. Cuerpo: %v", codigo, datos)
		}
		if datos["codigo"] != fmt.Sprintf("A-%d-61", isletaPruebaEnA) {
			t.Errorf("código de célula = %v", datos["codigo"])
		}
		c := e.celulasEnBase(t, isletaA)[61]
		if c.creadaPorAdmin || fmt.Sprint(c.formas) != "[1 2 3 4]" {
			t.Errorf("célula guardada como %+v (tenía que quedar creada por el cargador, con 4 individuos)", c)
		}
	})
}
