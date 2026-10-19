package handlers

import (
	"context"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/db"
)

func TestPorcentaje(t *testing.T) {
	if p := porcentaje(8, 9); p == nil || *p != 88.9 {
		t.Errorf("porcentaje(8, 9) = %v, se esperaba 88.9", p)
	}
	if p := porcentaje(0, 0); p != nil {
		t.Errorf("porcentaje(0, 0) = %v, se esperaba nil (no se divide por cero)", *p)
	}
}

func TestLeerFiltros(t *testing.T) {
	ahora := time.Date(2026, 10, 19, 12, 0, 0, 0, time.UTC)

	casos := []struct {
		nombre  string
		url     string
		esError bool
	}{
		{"sin filtros", "/api/metricas", false},
		{"todos los filtros", "/api/metricas?lugar=1&isleta=2&desde=2026-08&hasta=2026-10&forma=1", false},
		{"lugar que no es número", "/api/metricas?lugar=abc", true},
		{"forma 5", "/api/metricas?forma=5", true},
		{"forma 0", "/api/metricas?forma=0", true},
		{"mes mal escrito", "/api/metricas?desde=octubre", true},
		{"desde después de hasta", "/api/metricas?desde=2026-10&hasta=2026-08", true},
	}

	for _, caso := range casos {
		_, mensaje := leerFiltros(httptest.NewRequest("GET", caso.url, nil), ahora)
		if (mensaje != "") != caso.esError {
			t.Errorf("%s: mensaje = %q, se esperaba error = %v", caso.nombre, mensaje, caso.esError)
		}
	}

	// Sin "hasta", se usa el mes actual.
	filtros, _ := leerFiltros(httptest.NewRequest("GET", "/api/metricas", nil), ahora)
	if filtros.Hasta.Format("2006-01") != "2026-10" || filtros.Desde != nil {
		t.Errorf("sin filtros: desde %v, hasta %s; se esperaba desde nil y hasta 2026-10", filtros.Desde, filtros.Hasta.Format("2006-01"))
	}
}

// TestCalcularMetricasConBase compara con un caso calculado a mano con el seed (backend/seed/seed.sql):
// isleta C-1, solo el Árbol, desde la plantación. La C-1-10 está dada de baja, así que no cuenta.
// Último registro del árbol de cada célula (y su altura en el registro inicial):
//
//	C-1-1  oct  vivo  95 cm (inicial 68)         C-1-6  sept vivo  92 cm (inicial 75)
//	C-1-2  oct  vivo  94 cm (inicial 67)         C-1-7  oct  vivo  98 cm (inicial 71), plántulas
//	C-1-3  sept vivo  83 cm (inicial 66)         C-1-8  oct  MUERTO
//	C-1-4  oct  vivo  89 cm (inicial 62)         C-1-9  sept vivo  86 cm (inicial 69), frutos
//	C-1-5  oct  vivo  88 cm (inicial 61), 2 flores y frutos
//
// (C-1-1 también tiene frutos en octubre.)
//   - Supervivencia: 8 vivos ÷ 9 individuos = 88,9 %.
//   - Crecimiento: (27 + 27 + 17 + 27 + 27 + 17 + 27 + 17) ÷ 8 = 186 ÷ 8 = 23,25 → 23,3 cm.
//   - Floración: 1 (C-1-5) ÷ 8 vivos = 12,5 %.
//   - Frutos: 3 (C-1-1, C-1-5, C-1-9) ÷ 8 vivos = 37,5 %.
//   - Células con plántulas: 1 (C-1-7) ÷ 9 células activas = 11,1 %.
//
// Se saltea si no está DATABASE_URL.
func TestCalcularMetricasConBase(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("falta DATABASE_URL: cargá el .env y corré el seed para probar con la base")
	}

	ctx := context.Background()
	pool, err := db.Conectar(ctx)
	if err != nil {
		t.Fatalf("no se pudo conectar a la base: %v", err)
	}
	t.Cleanup(pool.Close)

	// Los ids pueden cambiar entre seeds: la isleta se busca por letra y número.
	var isletaC1 int64
	err = pool.QueryRow(ctx, `
		SELECT i.id FROM isletas i JOIN lugares l ON l.id = i.lugar_id
		WHERE l.letra = 'C' AND i.numero = 1`).Scan(&isletaC1)
	if err != nil {
		t.Fatalf("no se encontró la isleta C-1 (¿corriste el seed?): %v", err)
	}

	arbol := 1
	filtros := FiltrosMetricas{IsletaID: &isletaC1, Forma: &arbol, Hasta: time.Now()}
	m, err := CalcularMetricas(ctx, pool, filtros)
	if err != nil {
		t.Fatalf("CalcularMetricas: %v", err)
	}

	// igual compara un puntero con el número esperado (un nil nunca es igual).
	igual := func(nombre string, obtenido *float64, esperado float64) {
		if obtenido == nil || *obtenido != esperado {
			t.Errorf("%s = %v, se esperaba %v", nombre, obtenido, esperado)
		}
	}
	if m.CelulasPlantadas != 9 {
		t.Errorf("células plantadas = %d, se esperaban 9", m.CelulasPlantadas)
	}
	if m.IndividuosConRegistro != 9 {
		t.Errorf("individuos con registro = %d, se esperaban 9", m.IndividuosConRegistro)
	}
	igual("supervivencia", m.TasaSupervivencia, 88.9)
	igual("crecimiento", m.CrecimientoPromedioCm, 23.3)
	igual("floración", m.IndividuosEnFloracion, 12.5)
	igual("frutos", m.IndividuosConFrutos, 37.5)
	igual("plántulas", m.CelulasConPlantulas, 11.1)

	// Con el filtro de forma, la supervivencia por forma tiene solo el Árbol, con el mismo valor.
	if len(m.SupervivenciaPorForma) != 1 || m.SupervivenciaPorForma[0].FormaDeVida != 1 {
		t.Fatalf("supervivencia por forma = %+v, se esperaba solo el Árbol", m.SupervivenciaPorForma)
	}
	igual("supervivencia del Árbol", m.SupervivenciaPorForma[0].Tasa, 88.9)

	// Evolución: 4 meses. En el primero (el inicial) están los 9 vivos; en el último, que solo
	// cargaron 6 células (1, 2, 4, 5, 7 y 8), hay 5 vivos: 5 ÷ 6 = 83,3 %.
	if len(m.Evolucion) != 4 {
		t.Fatalf("la evolución tiene %d meses, se esperaban 4", len(m.Evolucion))
	}
	igual("supervivencia del primer mes", m.Evolucion[0].Supervivencia, 100)
	igual("supervivencia del último mes", m.Evolucion[3].Supervivencia, 83.3)
	// Altura promedio del Árbol en el primer mes: (68+67+66+62+61+75+71+70+69) ÷ 9 = 609 ÷ 9 = 67,7.
	if altura := m.Evolucion[0].AlturaPromedio[1]; altura != 67.7 {
		t.Errorf("altura del Árbol en el primer mes = %v, se esperaba 67.7", altura)
	}
}
