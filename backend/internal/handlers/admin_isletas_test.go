package handlers

import (
	"context"
	"fmt"
	"net/http"
	"testing"
)

// crearLugarPrueba inserta directo en la base un lugar con una de las letrasPrueba y devuelve su id.
func (e *entornoAdmin) crearLugarPrueba(t *testing.T, letra string) int64 {
	t.Helper()
	var id int64
	err := e.pool.QueryRow(context.Background(),
		`INSERT INTO lugares (letra, nombre, tipo) VALUES ($1, 'Lugar de prueba', 'colegio') RETURNING id`, letra).Scan(&id)
	if err != nil {
		t.Fatalf("no se pudo crear el lugar de prueba %s: %v", letra, err)
	}
	return id
}

// crearIsletaPrueba inserta una isleta en el lugar y devuelve su id.
func (e *entornoAdmin) crearIsletaPrueba(t *testing.T, lugarID int64, numero, filas, columnas int) int64 {
	t.Helper()
	var id int64
	err := e.pool.QueryRow(context.Background(), `
		INSERT INTO isletas (lugar_id, numero, filas, columnas) VALUES ($1, $2, $3, $4) RETURNING id`,
		lugarID, numero, filas, columnas).Scan(&id)
	if err != nil {
		t.Fatalf("no se pudo crear la isleta de prueba: %v", err)
	}
	return id
}

// crearCelulaPrueba inserta una célula (sin individuos) en esa posición del plano.
func (e *entornoAdmin) crearCelulaPrueba(t *testing.T, isletaID int64, numero, fila, columna int) {
	t.Helper()
	_, err := e.pool.Exec(context.Background(), `
		INSERT INTO celulas (isleta_id, numero, fila, columna, fecha_plantacion, creado_por, modificado_por)
		SELECT $1, $2, $3, $4, DATE '2026-11-25', u.id, u.id FROM usuarios u WHERE u.email = 'admin@celulas.test'`,
		isletaID, numero, fila, columna)
	if err != nil {
		t.Fatalf("no se pudo crear la célula de prueba: %v", err)
	}
}

// isletaGuardada es lo que importa de una isleta en la base.
type isletaGuardada struct {
	numero, filas, columnas int
	nombre                  *string
}

func (e *entornoAdmin) isletaEnBase(t *testing.T, id int64) isletaGuardada {
	t.Helper()
	var i isletaGuardada
	err := e.pool.QueryRow(context.Background(),
		`SELECT numero, nombre, filas, columnas FROM isletas WHERE id = $1`, id).Scan(&i.numero, &i.nombre, &i.filas, &i.columnas)
	if err != nil {
		t.Fatalf("no se pudo leer la isleta %d: %v", id, err)
	}
	return i
}

// idDeIsleta busca el id de la isleta por letra del lugar y número.
func (e *entornoAdmin) idDeIsleta(t *testing.T, letra string, numero int) int64 {
	t.Helper()
	var id int64
	err := e.pool.QueryRow(context.Background(), `
		SELECT i.id FROM isletas i JOIN lugares l ON l.id = i.lugar_id WHERE l.letra = $1 AND i.numero = $2`,
		letra, numero).Scan(&id)
	if err != nil {
		t.Fatalf("no existe la isleta %s-%d: %v", letra, numero, err)
	}
	return id
}

// TestAdminIsletas prueba crear y editar isletas (LUG-04, LUG-06, RN-02, RN-03).
// El plano es solo la grilla: se define al crear la isleta y se cambia al editarla.
func TestAdminIsletas(t *testing.T) {
	e := nuevoEntornoAdmin(t)
	idZ := e.crearLugarPrueba(t, "Z")
	ruta := func(id int64) string { return fmt.Sprintf("/api/admin/isletas/%d", id) }
	nueva := map[string]any{"lugarId": idZ, "numero": 1, "nombre": "Frente al aula magna", "filas": 5, "columnas": 6}

	t.Run("cargador y lector reciben 403 y no se crea nada", func(t *testing.T) {
		idA1 := e.idDeIsleta(t, "A", 1)
		for nombre, cookie := range map[string]*http.Cookie{"cargador": e.cargador, "lector": e.lector} {
			if codigo, _ := pedir(e.mux, cookie, "POST", "/api/admin/isletas", nueva); codigo != http.StatusForbidden {
				t.Errorf("%s POST: código = %d, se esperaba 403", nombre, codigo)
			}
			if codigo, _ := pedir(e.mux, cookie, "PUT", ruta(idA1), map[string]any{"numero": 1, "nombre": "Otro", "filas": 7, "columnas": 10}); codigo != http.StatusForbidden {
				t.Errorf("%s PUT: código = %d, se esperaba 403", nombre, codigo)
			}
		}
		var cuantas int
		e.pool.QueryRow(context.Background(), `SELECT count(*) FROM isletas WHERE lugar_id = $1`, idZ).Scan(&cuantas)
		if cuantas != 0 {
			t.Errorf("se crearon %d isletas sin ser admin", cuantas)
		}
	})

	var idZ1 int64
	t.Run("el admin crea una isleta y el lugar sugiere la siguiente", func(t *testing.T) {
		codigo, datos := pedir(e.mux, e.admin, "POST", "/api/admin/isletas", nueva)
		if codigo != http.StatusCreated {
			t.Fatalf("código = %d, se esperaba 201. Cuerpo: %v", codigo, datos)
		}
		if datos["numero"] != float64(1) || datos["nombre"] != "Frente al aula magna" || datos["filas"] != float64(5) ||
			datos["columnas"] != float64(6) || datos["tieneRegistros"] != false {
			t.Errorf("respuesta inesperada: %v", datos)
		}
		idZ1 = int64(datos["id"].(float64))
		i := e.isletaEnBase(t, idZ1)
		if i.numero != 1 || i.filas != 5 || i.columnas != 6 || i.nombre == nil || *i.nombre != "Frente al aula magna" {
			t.Errorf("en la base quedó %+v", i)
		}
		_, lista := pedir(e.mux, e.admin, "GET", "/api/admin/lugares", nil)
		for _, l := range lista["lugares"].([]any) {
			if lugar := l.(map[string]any); lugar["letra"] == "Z" && lugar["siguienteIsleta"] != float64(2) {
				t.Errorf("siguienteIsleta de Z = %v, se esperaba 2", lugar["siguienteIsleta"])
			}
		}
	})

	t.Run("el nombre es opcional", func(t *testing.T) {
		codigo, datos := pedir(e.mux, e.admin, "POST", "/api/admin/isletas",
			map[string]any{"lugarId": idZ, "numero": 3, "nombre": "", "filas": 1, "columnas": 30})
		if codigo != http.StatusCreated {
			t.Fatalf("código = %d, se esperaba 201. Cuerpo: %v", codigo, datos)
		}
		if i := e.isletaEnBase(t, int64(datos["id"].(float64))); i.nombre != nil {
			t.Errorf("nombre = %q, se esperaba NULL", *i.nombre)
		}
	})

	t.Run("un número repetido en el mismo lugar da 409 (RN-02)", func(t *testing.T) {
		codigo, datos := pedir(e.mux, e.admin, "POST", "/api/admin/isletas", nueva)
		if codigo != http.StatusConflict || datos["error"] != "Ya existe la isleta 1 en este lugar" {
			t.Errorf("código = %d, cuerpo = %v; se esperaba 409", codigo, datos)
		}
	})

	t.Run("datos inválidos dan 400 y un lugar que no existe da 404", func(t *testing.T) {
		casos := map[string]map[string]any{
			"número 0":          {"lugarId": idZ, "numero": 0, "filas": 5, "columnas": 5},
			"número muy grande": {"lugarId": idZ, "numero": 1000, "filas": 5, "columnas": 5},
			"filas 0":           {"lugarId": idZ, "numero": 7, "filas": 0, "columnas": 5},
			"columnas 31":       {"lugarId": idZ, "numero": 7, "filas": 5, "columnas": 31},
			"nombre muy largo":  {"lugarId": idZ, "numero": 7, "filas": 5, "columnas": 5, "nombre": string(make([]byte, 101))},
		}
		for nombre, cuerpo := range casos {
			if codigo, datos := pedir(e.mux, e.admin, "POST", "/api/admin/isletas", cuerpo); codigo != http.StatusBadRequest || datos["error"] == nil {
				t.Errorf("%s: código = %d, cuerpo = %v; se esperaba 400 con mensaje", nombre, codigo, datos)
			}
		}
		codigo, _ := pedir(e.mux, e.admin, "POST", "/api/admin/isletas",
			map[string]any{"lugarId": 999999, "numero": 1, "filas": 5, "columnas": 5})
		if codigo != http.StatusNotFound {
			t.Errorf("lugar inexistente: código = %d, se esperaba 404", codigo)
		}
	})

	t.Run("sin registros, el admin cambia el número, el nombre y la grilla", func(t *testing.T) {
		codigo, datos := pedir(e.mux, e.admin, "PUT", ruta(idZ1),
			map[string]any{"numero": 2, "nombre": "Junto al estacionamiento", "filas": 8, "columnas": 9})
		if codigo != http.StatusOK || datos["numero"] != float64(2) || datos["filas"] != float64(8) || datos["columnas"] != float64(9) {
			t.Fatalf("código = %d, cuerpo = %v; se esperaba 200 con el número 2 y la grilla 8 × 9", codigo, datos)
		}
		i := e.isletaEnBase(t, idZ1)
		if i.numero != 2 || i.nombre == nil || *i.nombre != "Junto al estacionamiento" || i.filas != 8 || i.columnas != 9 {
			t.Errorf("en la base quedó %+v", i)
		}
	})

	t.Run("si la grilla no alcanza para las células, no se guarda (LUG-06)", func(t *testing.T) {
		e.crearCelulaPrueba(t, idZ1, 1, 4, 5)
		e.crearCelulaPrueba(t, idZ1, 2, 2, 9)
		codigo, datos := pedir(e.mux, e.admin, "PUT", ruta(idZ1), map[string]any{"numero": 2, "filas": 3, "columnas": 8})
		if codigo != http.StatusBadRequest || datos["error"] != "La grilla es chica: hay células hasta la fila 4 y la columna 9" {
			t.Errorf("código = %d, cuerpo = %v; se esperaba 400 con la fila y la columna más altas", codigo, datos)
		}
		if i := e.isletaEnBase(t, idZ1); i.filas != 8 || i.columnas != 9 || i.nombre == nil {
			t.Errorf("la isleta cambió igual: %+v", i)
		}
	})

	t.Run("si la grilla alcanza justo, se guarda sin mover las células", func(t *testing.T) {
		codigo, datos := pedir(e.mux, e.admin, "PUT", ruta(idZ1), map[string]any{"numero": 2, "filas": 4, "columnas": 9})
		if codigo != http.StatusOK {
			t.Fatalf("código = %d, se esperaba 200. Cuerpo: %v", codigo, datos)
		}
		if i := e.isletaEnBase(t, idZ1); i.filas != 4 || i.columnas != 9 {
			t.Errorf("en la base quedó %+v", i)
		}
		var cuantas int
		e.pool.QueryRow(context.Background(),
			`SELECT count(*) FROM celulas WHERE isleta_id = $1 AND ((fila = 4 AND columna = 5) OR (fila = 2 AND columna = 9))`, idZ1).Scan(&cuantas)
		if cuantas != 2 {
			t.Errorf("las células se movieron: quedan %d en su lugar, se esperaban 2", cuantas)
		}
	})

	t.Run("editar con una grilla inválida da 400", func(t *testing.T) {
		casos := map[string]map[string]any{
			"sin filas ni columnas": {"numero": 2},
			"filas 0":               {"numero": 2, "filas": 0, "columnas": 9},
			"columnas 31":           {"numero": 2, "filas": 4, "columnas": 31},
		}
		for nombre, cuerpo := range casos {
			if codigo, datos := pedir(e.mux, e.admin, "PUT", ruta(idZ1), cuerpo); codigo != http.StatusBadRequest || datos["error"] == nil {
				t.Errorf("%s: código = %d, cuerpo = %v; se esperaba 400 con mensaje", nombre, codigo, datos)
			}
		}
	})

	t.Run("cambiar a un número que ya usa otra isleta del lugar da 409", func(t *testing.T) {
		codigo, datos := pedir(e.mux, e.admin, "PUT", ruta(idZ1), map[string]any{"numero": 3, "filas": 4, "columnas": 9})
		if codigo != http.StatusConflict || datos["error"] != "Ya existe la isleta 3 en este lugar" {
			t.Errorf("código = %d, cuerpo = %v; se esperaba 409", codigo, datos)
		}
	})

	t.Run("con registros, el número no cambia (RN-03) pero el nombre sí", func(t *testing.T) {
		idA1 := e.idDeIsleta(t, "A", 1)
		antes := e.isletaEnBase(t, idA1)
		t.Cleanup(func() {
			e.pool.Exec(context.Background(), `UPDATE isletas SET nombre = $1 WHERE id = $2`, antes.nombre, idA1)
		})
		codigo, datos := pedir(e.mux, e.admin, "PUT", ruta(idA1), map[string]any{"numero": 9, "nombre": antes.nombre, "filas": antes.filas, "columnas": antes.columnas})
		if codigo != http.StatusBadRequest || datos["error"] != "El número no se puede cambiar porque la isleta ya tiene registros" {
			t.Errorf("código = %d, cuerpo = %v; se esperaba 400 por RN-03", codigo, datos)
		}
		if i := e.isletaEnBase(t, idA1); i.numero != 1 {
			t.Fatalf("el número de A-1 cambió a %d", i.numero)
		}
		codigo, _ = pedir(e.mux, e.admin, "PUT", ruta(idA1), map[string]any{"numero": 1, "nombre": "Isleta editada", "filas": antes.filas, "columnas": antes.columnas})
		if codigo != http.StatusOK {
			t.Errorf("editar el nombre de A-1: código = %d, se esperaba 200", codigo)
		}
		if i := e.isletaEnBase(t, idA1); i.nombre == nil || *i.nombre != "Isleta editada" {
			t.Errorf("el nombre de A-1 no se editó")
		}
	})

	t.Run("editar una isleta que no existe da 404", func(t *testing.T) {
		if codigo, _ := pedir(e.mux, e.admin, "PUT", ruta(999999), map[string]any{"numero": 1, "filas": 5, "columnas": 5}); codigo != http.StatusNotFound {
			t.Errorf("código = %d, se esperaba 404", codigo)
		}
	})
}
