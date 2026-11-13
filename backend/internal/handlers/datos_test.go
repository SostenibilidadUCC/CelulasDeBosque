package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/db"
	"github.com/xuri/excelize/v2"
)

func TestInterpretarCodigo(t *testing.T) {
	casos := []struct {
		q             string
		ok            bool
		letra         string
		isleta, celda int // 0 = sin filtro
		forma         int
	}{
		{"", true, "", 0, 0, 0},
		{"45", true, "", 0, 45, 0},
		{"a", true, "A", 0, 0, 0},
		{"A-1", true, "A", 1, 0, 0},
		{" a-1-45 ", true, "A", 1, 45, 0},
		{"A-1-45-1", true, "A", 1, 45, 1},
		// Mientras se escribe: el guion del final no vacía la tabla.
		{"A-1-", true, "A", 1, 0, 0},
		{"a-", true, "A", 0, 0, 0},
		{"A-1-45-5", false, "", 0, 0, 0},   // forma de vida 5 no existe
		{"A-1-45-1-2", false, "", 0, 0, 0}, // demasiadas partes
		{"AB-1", false, "", 0, 0, 0},
		{"A-uno", false, "", 0, 0, 0},
		{"0", false, "", 0, 0, 0},
	}
	valor := func(p *int) int {
		if p == nil {
			return 0
		}
		return *p
	}
	for _, caso := range casos {
		b, ok := interpretarCodigo(caso.q)
		if ok != caso.ok {
			t.Errorf("%q: ok = %v, se esperaba %v", caso.q, ok, caso.ok)
			continue
		}
		if !ok {
			continue
		}
		letra := ""
		if b.letra != nil {
			letra = *b.letra
		}
		if letra != caso.letra || valor(b.isleta) != caso.isleta || valor(b.celula) != caso.celda || valor(b.forma) != caso.forma {
			t.Errorf("%q: se entendió %s-%d-%d-%d", caso.q, letra, valor(b.isleta), valor(b.celula), valor(b.forma))
		}
	}
}

func TestOrdenSQL(t *testing.T) {
	// Por defecto, lo más reciente primero.
	if orden, ok := ordenSQL("", ""); !ok || !strings.HasPrefix(orden, "r.periodo DESC") {
		t.Errorf("orden por defecto = %q", orden)
	}
	if orden, ok := ordenSQL("altura", "asc"); !ok || !strings.HasPrefix(orden, "m.altura_cm ASC") {
		t.Errorf("orden por altura = %q", orden)
	}
	// Lo que no está en la lista no se acepta: nunca llega al SQL.
	for _, malo := range [][2]string{{"altura; DROP TABLE registros", ""}, {"altura", "arriba"}} {
		if _, ok := ordenSQL(malo[0], malo[1]); ok {
			t.Errorf("ordenSQL(%q, %q) se aceptó", malo[0], malo[1])
		}
	}
}

func TestAbreviarNombre(t *testing.T) {
	casos := map[string]string{
		"Magdalena Gómez":     "M. Gómez",
		"Ángela María Pérez":  "Á. Pérez",
		"Admin":               "Admin",
		"  Cande   Rojo  ":    "C. Rojo",
		"Cargador del Campus": "C. Campus",
	}
	for nombre, esperado := range casos {
		if obtenido := abreviarNombre(nombre); obtenido != esperado {
			t.Errorf("abreviarNombre(%q) = %q, se esperaba %q", nombre, obtenido, esperado)
		}
	}
}

func TestFilaExcelIndividuoMuerto(t *testing.T) {
	muerto := false
	fila := filaExcel(filaDatos{CodigoIndividuo: "C-1-8-1", FechaMedicion: "2026-10-05", Vivo: &muerto, CargadoPor: "C. Campus"})
	if len(fila) != len(columnasExcel) {
		t.Fatalf("la fila tiene %d columnas, se esperaban %d", len(fila), len(columnasExcel))
	}
	if fila[6] != "05/10/2026" || fila[9] != "Muerto" {
		t.Errorf("fecha %v y estado %v; se esperaba 05/10/2026 y Muerto", fila[6], fila[9])
	}
	// RN-08: altura, flores, frutos y plántulas vacías.
	for _, i := range []int{10, 11, 12, 13} {
		if fila[i] != nil {
			t.Errorf("la columna %s tiene %v, se esperaba vacía", columnasExcel[i], fila[i])
		}
	}
}

func TestNombreArchivoExcel(t *testing.T) {
	hasta := time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC)
	desde := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	if n := nombreArchivoExcel(FiltrosMetricas{Desde: &desde, Hasta: hasta}, "A", nil); n != "celulas_A_2026-09_2026-11.xlsx" {
		t.Errorf("con desde: %q", n)
	}
	// Desde la plantación: el primer período de los datos.
	filas := []filaDatos{{Periodo: "2026-10"}, {Periodo: "2026-08"}}
	if n := nombreArchivoExcel(FiltrosMetricas{Hasta: hasta}, "", filas); n != "celulas_todos_2026-08_2026-11.xlsx" {
		t.Errorf("sin desde: %q", n)
	}
}

// Con la base del seed: la isleta C-1, solo el Árbol (ver TestCalcularMetricasConBase).
func TestDatosConBase(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("falta DATABASE_URL: cargá el .env y corré el seed para probar con la base")
	}
	ctx := context.Background()
	pool, err := db.Conectar(ctx)
	if err != nil {
		t.Fatalf("no se pudo conectar a la base: %v", err)
	}
	t.Cleanup(pool.Close)

	var lugarC, isletaC1 int64
	if err := pool.QueryRow(ctx, `
		SELECT l.id, i.id FROM isletas i JOIN lugares l ON l.id = i.lugar_id
		WHERE l.letra = 'C' AND i.numero = 1`).Scan(&lugarC, &isletaC1); err != nil {
		t.Fatalf("no se encontró la isleta C-1 (¿corriste el seed?): %v", err)
	}
	// Lo esperado se cuenta directo en la base: un Árbol por cada registro no anulado, de las células
	// activas y de las dadas de baja hasta su fecha de baja (RN-14).
	var esperado int
	if err := pool.QueryRow(ctx, `
		SELECT count(*) FROM registros r JOIN celulas c ON c.id = r.celula_id
		WHERE c.isleta_id = $1 AND NOT r.anulado
		  AND (c.estado = 'activa' OR r.fecha_medicion <= c.fecha_baja)`, isletaC1).Scan(&esperado); err != nil {
		t.Fatalf("no se pudieron contar los registros: %v", err)
	}

	// Como la pantalla: la isleta siempre va junto con su lugar.
	base := "?lugar=" + strconv.FormatInt(lugarC, 10) + "&isleta=" + strconv.FormatInt(isletaC1, 10) + "&forma=1"
	pedir := func(handler http.HandlerFunc, url string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		handler(w, httptest.NewRequest("GET", url, nil))
		return w
	}

	t.Run("tabla paginada", func(t *testing.T) {
		w := pedir(Datos(pool), "/api/datos"+base)
		if w.Code != http.StatusOK {
			t.Fatalf("código %d: %s", w.Code, w.Body)
		}
		var r respuestaDatos
		if err := json.Unmarshal(w.Body.Bytes(), &r); err != nil {
			t.Fatalf("la respuesta no es JSON: %v", err)
		}
		if r.Total != esperado {
			t.Errorf("total = %d, se esperaba %d", r.Total, esperado)
		}
		if len(r.Filas) != min(esperado, filasPorPagina) {
			t.Errorf("llegaron %d filas", len(r.Filas))
		}
		for _, f := range r.Filas {
			if f.FormaDeVida != 1 || !strings.HasPrefix(f.CodigoIndividuo, "C-1-") || !strings.HasSuffix(f.CodigoIndividuo, "-1") {
				t.Errorf("fila de otro lugar o forma: %+v", f)
			}
			// RN-08: un individuo muerto no tiene altura.
			if f.Vivo != nil && !*f.Vivo && f.AlturaCm != nil {
				t.Errorf("%s está muerto y tiene altura %v", f.CodigoIndividuo, *f.AlturaCm)
			}
		}
	})

	t.Run("buscador por código", func(t *testing.T) {
		var r respuestaDatos
		_ = json.Unmarshal(pedir(Datos(pool), "/api/datos"+base+"&q=C-1-8").Body.Bytes(), &r)
		if r.Total == 0 {
			t.Fatal("C-1-8 no devolvió filas")
		}
		for _, f := range r.Filas {
			if f.CodigoIndividuo != "C-1-8-1" {
				t.Errorf("el buscador trajo %s", f.CodigoIndividuo)
			}
		}
	})

	// RN-14: C-1-10 se dio de baja el 20/10/2026 y tiene 3 registros anteriores (agosto, septiembre y
	// octubre). Su historial tiene que seguir en la tabla, y nada medido después de la baja.
	t.Run("célula dada de baja con su historial", func(t *testing.T) {
		var fechaBaja time.Time
		var registrosAntes int
		if err := pool.QueryRow(ctx, `
			SELECT c.fecha_baja, count(r.id) FILTER (WHERE NOT r.anulado AND r.fecha_medicion <= c.fecha_baja)
			FROM celulas c LEFT JOIN registros r ON r.celula_id = c.id
			WHERE c.isleta_id = $1 AND c.numero = 10 AND c.estado = 'baja'
			GROUP BY c.id`, isletaC1).Scan(&fechaBaja, &registrosAntes); err != nil {
			t.Fatalf("no se encontró C-1-10 dada de baja (¿corriste el seed?): %v", err)
		}
		if registrosAntes == 0 {
			t.Fatal("C-1-10 no tiene registros anteriores a la baja: el caso no se puede probar")
		}

		var r respuestaDatos
		_ = json.Unmarshal(pedir(Datos(pool), "/api/datos"+base+"&q=C-1-10").Body.Bytes(), &r)
		if r.Total != registrosAntes {
			t.Errorf("C-1-10 tiene %d filas, se esperaban %d (sus registros hasta la baja)", r.Total, registrosAntes)
		}
		for _, f := range r.Filas {
			if f.FechaMedicion > fechaBaja.Format("2006-01-02") {
				t.Errorf("apareció un registro del %s, posterior a la baja (%s)", f.FechaMedicion, fechaBaja.Format("2006-01-02"))
			}
		}

		// Y también en el Excel.
		libro, err := excelize.OpenReader(pedir(DatosExcel(pool), "/api/datos/excel"+base+"&q=C-1-10").Body)
		if err != nil {
			t.Fatalf("el Excel no se puede abrir: %v", err)
		}
		defer libro.Close()
		filas, _ := libro.GetRows("Datos")
		if len(filas) != registrosAntes+1 {
			t.Errorf("el Excel de C-1-10 tiene %d filas, se esperaban %d (más los títulos)", len(filas), registrosAntes+1)
		}
	})

	t.Run("orden o página inválidos", func(t *testing.T) {
		for _, url := range []string{"/api/datos?orden=foto", "/api/datos?pagina=99999999999999999"} {
			if w := pedir(Datos(pool), url); w.Code != http.StatusBadRequest {
				t.Errorf("%s: código %d, se esperaba 400", url, w.Code)
			}
		}
	})

	t.Run("página pasada del final", func(t *testing.T) {
		// Se pide una página que no existe: tiene que volver la última, con el total y sus filas.
		var r respuestaDatos
		_ = json.Unmarshal(pedir(Datos(pool), "/api/datos"+base+"&pagina=500").Body.Bytes(), &r)
		ultima := (esperado-1)/filasPorPagina + 1
		if r.Total != esperado || r.Pagina != ultima || len(r.Filas) == 0 {
			t.Errorf("total %d, página %d, %d filas; se esperaba total %d en la página %d", r.Total, r.Pagina, len(r.Filas), esperado, ultima)
		}
	})

	t.Run("excel", func(t *testing.T) {
		w := pedir(DatosExcel(pool), "/api/datos/excel"+base)
		if w.Code != http.StatusOK {
			t.Fatalf("código %d: %s", w.Code, w.Body)
		}
		if d := w.Header().Get("Content-Disposition"); !strings.Contains(d, "celulas_C_") {
			t.Errorf("nombre de archivo: %q", d)
		}
		libro, err := excelize.OpenReader(w.Body)
		if err != nil {
			t.Fatalf("el Excel no se puede abrir: %v", err)
		}
		defer libro.Close()
		filas, err := libro.GetRows("Datos")
		if err != nil {
			t.Fatalf("no se pudo leer la hoja Datos: %v", err)
		}
		if len(filas) != esperado+1 {
			t.Errorf("el Excel tiene %d filas, se esperaban %d (más los títulos)", len(filas), esperado+1)
		}
		if strings.Join(filas[0], ",") != strings.Join(columnasExcel, ",") {
			t.Errorf("títulos = %v", filas[0])
		}
		// Los acentos llegan bien (el "está listo cuando" del T21).
		if len(filas) > 1 && filas[1][4] != "Árbol" {
			t.Errorf("forma de vida = %q, se esperaba Árbol", filas[1][4])
		}
		// Las alturas van como número, no como texto (para que Excel pueda promediarlas).
		tipo, err := libro.GetCellType("Datos", "K2")
		if err != nil || (tipo != excelize.CellTypeNumber && tipo != excelize.CellTypeUnset) {
			t.Errorf("la altura de K2 es de tipo %v", tipo)
		}
	})
}
