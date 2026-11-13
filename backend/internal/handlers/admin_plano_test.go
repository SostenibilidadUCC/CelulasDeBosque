package handlers

import (
	"context"
	"fmt"
	"net/http"
	"testing"
)

// Las fotos que crean los tests de administración tienen esta ruta en R2 (no existen de verdad).
const prefijoFotosPrueba = "prueba-t20/"

// crearFotoPrueba inserta una fila en fotos (sin archivo en R2) y devuelve su id.
// Se borra sola al terminar el test, después de los lugares de prueba (por la clave foránea del plano).
func (e *entornoAdmin) crearFotoPrueba(t *testing.T, nombre string) int64 {
	t.Helper()
	ctx := context.Background()
	var id int64
	err := e.pool.QueryRow(ctx, `
		INSERT INTO fotos (ruta_r2, subida_por)
		VALUES ($1, (SELECT id FROM usuarios WHERE email = 'admin@celulas.test'))
		RETURNING id`, prefijoFotosPrueba+nombre).Scan(&id)
	if err != nil {
		t.Fatalf("no se pudo crear la foto de prueba: %v", err)
	}
	t.Cleanup(func() {
		borrarLugaresPrueba(ctx, e.pool)
		e.pool.Exec(ctx, `DELETE FROM fotos WHERE id = $1`, id)
	})
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

// planoEnBase lee el plano de la isleta.
func (e *entornoAdmin) planoEnBase(t *testing.T, isletaID int64) (fotoID *int64, filas, columnas int) {
	t.Helper()
	err := e.pool.QueryRow(context.Background(),
		`SELECT plano_foto_id, filas, columnas FROM isletas WHERE id = $1`, isletaID).Scan(&fotoID, &filas, &columnas)
	if err != nil {
		t.Fatalf("no se pudo leer el plano de la isleta %d: %v", isletaID, err)
	}
	return
}

// TestAdminPlano prueba cargar y reemplazar el plano de una isleta (LUG-05, LUG-06).
func TestAdminPlano(t *testing.T) {
	e := nuevoEntornoAdmin(t)
	idZ := e.crearLugarPrueba(t, "Z")
	isleta := e.crearIsletaPrueba(t, idZ, 1, 5, 6)
	foto1 := e.crearFotoPrueba(t, "plano-1.jpg")
	foto2 := e.crearFotoPrueba(t, "plano-2.jpg")
	ruta := func(id int64) string { return fmt.Sprintf("/api/admin/isletas/%d/plano", id) }

	t.Run("cargador y lector reciben 403 y el plano no cambia", func(t *testing.T) {
		for nombre, cookie := range map[string]*http.Cookie{"cargador": e.cargador, "lector": e.lector} {
			codigo, _ := pedir(e.mux, cookie, "POST", ruta(isleta), map[string]any{"fotoId": foto1, "filas": 10, "columnas": 10})
			if codigo != http.StatusForbidden {
				t.Errorf("%s: código = %d, se esperaba 403", nombre, codigo)
			}
		}
		if fotoID, filas, _ := e.planoEnBase(t, isleta); fotoID != nil || filas != 5 {
			t.Errorf("el plano cambió sin ser admin")
		}
	})

	t.Run("el admin carga el plano con su grilla", func(t *testing.T) {
		codigo, datos := pedir(e.mux, e.admin, "POST", ruta(isleta), map[string]any{"fotoId": foto1, "filas": 10, "columnas": 12})
		if codigo != http.StatusOK {
			t.Fatalf("código = %d, se esperaba 200. Cuerpo: %v", codigo, datos)
		}
		if datos["planoFotoId"] != float64(foto1) || datos["filas"] != float64(10) || datos["columnas"] != float64(12) {
			t.Errorf("respuesta inesperada: %v", datos)
		}
		if fotoID, filas, columnas := e.planoEnBase(t, isleta); fotoID == nil || *fotoID != foto1 || filas != 10 || columnas != 12 {
			t.Errorf("en la base quedó foto %v, %d × %d", fotoID, filas, columnas)
		}
	})

	t.Run("si la grilla no alcanza para las células, no se guarda (LUG-06)", func(t *testing.T) {
		e.crearCelulaPrueba(t, isleta, 1, 4, 5)
		e.crearCelulaPrueba(t, isleta, 2, 2, 9)
		codigo, datos := pedir(e.mux, e.admin, "POST", ruta(isleta), map[string]any{"fotoId": foto2, "filas": 3, "columnas": 8})
		if codigo != http.StatusBadRequest || datos["error"] != "La grilla es chica: hay células hasta la fila 4 y la columna 9" {
			t.Errorf("código = %d, cuerpo = %v; se esperaba 400 con la fila y la columna más altas", codigo, datos)
		}
		if fotoID, filas, columnas := e.planoEnBase(t, isleta); *fotoID != foto1 || filas != 10 || columnas != 12 {
			t.Errorf("el plano cambió igual: foto %d, %d × %d", *fotoID, filas, columnas)
		}
	})

	t.Run("se reemplaza la imagen sin perder las células si la grilla alcanza justo", func(t *testing.T) {
		codigo, datos := pedir(e.mux, e.admin, "POST", ruta(isleta), map[string]any{"fotoId": foto2, "filas": 4, "columnas": 9})
		if codigo != http.StatusOK {
			t.Fatalf("código = %d, se esperaba 200. Cuerpo: %v", codigo, datos)
		}
		if fotoID, filas, columnas := e.planoEnBase(t, isleta); *fotoID != foto2 || filas != 4 || columnas != 9 {
			t.Errorf("en la base quedó foto %d, %d × %d", *fotoID, filas, columnas)
		}
		var cuantas int
		e.pool.QueryRow(context.Background(), `SELECT count(*) FROM celulas WHERE isleta_id = $1`, isleta).Scan(&cuantas)
		if cuantas != 2 {
			t.Errorf("la isleta tiene %d células, se esperaban 2", cuantas)
		}
	})

	t.Run("sin fotoId se cambia solo la grilla y se conserva la imagen", func(t *testing.T) {
		codigo, _ := pedir(e.mux, e.admin, "POST", ruta(isleta), map[string]any{"filas": 6, "columnas": 9})
		if codigo != http.StatusOK {
			t.Fatalf("código = %d, se esperaba 200", codigo)
		}
		if fotoID, filas, _ := e.planoEnBase(t, isleta); fotoID == nil || *fotoID != foto2 || filas != 6 {
			t.Errorf("en la base quedó foto %v y %d filas", fotoID, filas)
		}
	})

	t.Run("datos inválidos dan 400 y una isleta que no existe da 404", func(t *testing.T) {
		casos := map[string]map[string]any{
			"filas 0":            {"fotoId": foto1, "filas": 0, "columnas": 9},
			"columnas 31":        {"fotoId": foto1, "filas": 6, "columnas": 31},
			"foto que no existe": {"fotoId": 999999999, "filas": 6, "columnas": 9},
		}
		for nombre, cuerpo := range casos {
			if codigo, datos := pedir(e.mux, e.admin, "POST", ruta(isleta), cuerpo); codigo != http.StatusBadRequest || datos["error"] == nil {
				t.Errorf("%s: código = %d, cuerpo = %v; se esperaba 400 con mensaje", nombre, codigo, datos)
			}
		}
		if codigo, _ := pedir(e.mux, e.admin, "POST", ruta(999999), map[string]any{"filas": 6, "columnas": 9}); codigo != http.StatusNotFound {
			t.Errorf("isleta inexistente: código = %d, se esperaba 404", codigo)
		}
	})
}
