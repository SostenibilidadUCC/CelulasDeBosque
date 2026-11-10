package handlers

import (
	"context"
	"fmt"
	"net/http"
	"testing"
)

// celulaEnBase es una célula guardada, con las formas de vida de sus individuos.
type celulaEnBase struct {
	numero, fila, columna int
	fecha                 string
	creadaPorAdmin        bool
	formas                []int
}

func (e *entornoAdmin) celulasEnBase(t *testing.T, isletaID int64) map[int]celulaEnBase {
	t.Helper()
	filas, err := e.pool.Query(context.Background(), `
		SELECT c.numero, c.fila, c.columna, to_char(c.fecha_plantacion, 'YYYY-MM-DD'),
		       u.email = 'admin@celulas.test',
		       COALESCE(array_agg(ind.forma_de_vida_id ORDER BY ind.forma_de_vida_id) FILTER (WHERE ind.id IS NOT NULL), '{}')
		FROM celulas c
		JOIN usuarios u ON u.id = c.creado_por
		LEFT JOIN individuos ind ON ind.celula_id = c.id
		WHERE c.isleta_id = $1
		GROUP BY c.id, u.email`, isletaID)
	if err != nil {
		t.Fatalf("no se pudieron leer las células: %v", err)
	}
	defer filas.Close()
	celulas := map[int]celulaEnBase{}
	for filas.Next() {
		var c celulaEnBase
		var formas []int32
		if err := filas.Scan(&c.numero, &c.fila, &c.columna, &c.fecha, &c.creadaPorAdmin, &formas); err != nil {
			t.Fatalf("no se pudo leer una célula: %v", err)
		}
		for _, f := range formas {
			c.formas = append(c.formas, int(f))
		}
		celulas[c.numero] = c
	}
	return celulas
}

// TestAdminCelulasLote prueba crear células en lote con vista previa (LUG-07, RN-01, RN-02).
func TestAdminCelulasLote(t *testing.T) {
	e := nuevoEntornoAdmin(t)
	idZ := e.crearLugarPrueba(t, "Z")
	isleta := e.crearIsletaPrueba(t, idZ, 1, 3, 3) // grilla de 3 × 3 = 9 celdas
	e.crearCelulaPrueba(t, isleta, 2, 1, 2)        // la célula 2 ya ocupa la fila 1, columna 2
	ruta := fmt.Sprintf("/api/admin/isletas/%d/celulas-lote", isleta)
	lote := map[string]any{"desde": 3, "hasta": 6, "fechaPlantacion": "2026-11-25"}

	// Se ubican de izquierda a derecha y de arriba abajo, salteando la celda ocupada.
	esperadas := []struct {
		numero, fila, columna int
		codigo                string
	}{
		{3, 1, 1, "Z-1-3"},
		{4, 1, 3, "Z-1-4"},
		{5, 2, 1, "Z-1-5"},
		{6, 2, 2, "Z-1-6"},
	}
	comprobarRespuesta := func(t *testing.T, datos map[string]any) {
		t.Helper()
		celulas, _ := datos["celulas"].([]any)
		if len(celulas) != len(esperadas) {
			t.Fatalf("llegaron %d células, se esperaban %d: %v", len(celulas), len(esperadas), datos)
		}
		for i, esperada := range esperadas {
			c := celulas[i].(map[string]any)
			if c["numero"] != float64(esperada.numero) || c["fila"] != float64(esperada.fila) ||
				c["columna"] != float64(esperada.columna) || c["codigo"] != esperada.codigo {
				t.Errorf("célula %d = %v, se esperaba %+v", i, c, esperada)
			}
		}
	}

	t.Run("cargador y lector reciben 403 y no se crea nada", func(t *testing.T) {
		for nombre, cookie := range map[string]*http.Cookie{"cargador": e.cargador, "lector": e.lector} {
			if codigo, _ := pedir(e.mux, cookie, "POST", ruta, lote); codigo != http.StatusForbidden {
				t.Errorf("%s: código = %d, se esperaba 403", nombre, codigo)
			}
		}
		if n := len(e.celulasEnBase(t, isleta)); n != 1 {
			t.Errorf("la isleta tiene %d células, se esperaba 1", n)
		}
	})

	t.Run("la vista previa muestra dónde va cada célula y no guarda nada", func(t *testing.T) {
		codigo, datos := pedir(e.mux, e.admin, "POST", ruta+"?vistaPrevia=true", lote)
		if codigo != http.StatusOK {
			t.Fatalf("código = %d, se esperaba 200. Cuerpo: %v", codigo, datos)
		}
		comprobarRespuesta(t, datos)
		if n := len(e.celulasEnBase(t, isleta)); n != 1 {
			t.Errorf("la vista previa guardó células: la isleta tiene %d", n)
		}
	})

	t.Run("al confirmar se crean las células con sus 4 individuos", func(t *testing.T) {
		codigo, datos := pedir(e.mux, e.admin, "POST", ruta, lote)
		if codigo != http.StatusCreated {
			t.Fatalf("código = %d, se esperaba 201. Cuerpo: %v", codigo, datos)
		}
		comprobarRespuesta(t, datos)
		celulas := e.celulasEnBase(t, isleta)
		if len(celulas) != 5 {
			t.Fatalf("la isleta tiene %d células, se esperaban 5", len(celulas))
		}
		for _, esperada := range esperadas {
			c := celulas[esperada.numero]
			if c.fila != esperada.fila || c.columna != esperada.columna || c.fecha != "2026-11-25" || !c.creadaPorAdmin {
				t.Errorf("célula %d guardada como %+v", esperada.numero, c)
			}
			if fmt.Sprint(c.formas) != "[1 2 3 4]" {
				t.Errorf("la célula %d tiene individuos de las formas %v, se esperaban [1 2 3 4] (RN-01)", esperada.numero, c.formas)
			}
		}
	})

	t.Run("números ya usados en la isleta dan 409 y no se crea ninguna", func(t *testing.T) {
		codigo, datos := pedir(e.mux, e.admin, "POST", ruta, map[string]any{"desde": 6, "hasta": 8, "fechaPlantacion": "2026-11-25"})
		if codigo != http.StatusConflict || datos["error"] != "Ya existen en esta isleta las células 6" {
			t.Errorf("código = %d, cuerpo = %v; se esperaba 409 con los números repetidos", codigo, datos)
		}
		if n := len(e.celulasEnBase(t, isleta)); n != 5 {
			t.Errorf("la isleta tiene %d células, se esperaban 5", n)
		}
	})

	t.Run("si no hay celdas libres suficientes da 400 y no se crea ninguna", func(t *testing.T) {
		codigo, datos := pedir(e.mux, e.admin, "POST", ruta, map[string]any{"desde": 10, "hasta": 15, "fechaPlantacion": "2026-11-25"})
		if codigo != http.StatusBadRequest || datos["error"] != "No entran: son 6 células y quedan 4 celdas libres en el plano" {
			t.Errorf("código = %d, cuerpo = %v; se esperaba 400 por falta de lugar", codigo, datos)
		}
		if n := len(e.celulasEnBase(t, isleta)); n != 5 {
			t.Errorf("la isleta tiene %d células, se esperaban 5", n)
		}
	})

	t.Run("datos inválidos dan 400 y una isleta que no existe da 404", func(t *testing.T) {
		casos := map[string]map[string]any{
			"hasta menor que desde": {"desde": 9, "hasta": 8, "fechaPlantacion": "2026-11-25"},
			"desde 0":               {"desde": 0, "hasta": 2, "fechaPlantacion": "2026-11-25"},
			"más de 900 células":    {"desde": 1, "hasta": 901, "fechaPlantacion": "2026-11-25"},
			"fecha inválida":        {"desde": 10, "hasta": 11, "fechaPlantacion": "25/11/2026"},
			"sin fecha":             {"desde": 10, "hasta": 11},
		}
		for nombre, cuerpo := range casos {
			if codigo, datos := pedir(e.mux, e.admin, "POST", ruta, cuerpo); codigo != http.StatusBadRequest || datos["error"] == nil {
				t.Errorf("%s: código = %d, cuerpo = %v; se esperaba 400 con mensaje", nombre, codigo, datos)
			}
		}
		if codigo, _ := pedir(e.mux, e.admin, "POST", "/api/admin/isletas/999999/celulas-lote", lote); codigo != http.StatusNotFound {
			t.Errorf("isleta inexistente: código = %d, se esperaba 404", codigo)
		}
	})
}
