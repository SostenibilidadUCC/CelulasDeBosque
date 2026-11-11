package handlers

import (
	"testing"
	"time"
)

// ALT-04: la fecha de plantación no puede ser futura. No usa la base: corre siempre.
func TestValidarFechaPlantacion(t *testing.T) {
	// 11/11/2026 a las 23:30 en Córdoba ya es 12/11 en UTC: "hoy" tiene que seguir siendo el 11.
	ahora := time.Date(2026, 11, 12, 2, 30, 0, 0, time.UTC)

	validas := []string{"2026-11-11", "2026-11-10", "2025-03-01"}
	for _, texto := range validas {
		fecha, mensaje := validarFechaPlantacion(texto, ahora)
		if mensaje != "" || fecha.Format("2006-01-02") != texto {
			t.Errorf("%s: fecha = %v, mensaje = %q; se esperaba válida", texto, fecha, mensaje)
		}
	}

	invalidas := map[string]string{
		"mañana":         "2026-11-12",
		"el lanzamiento": "2026-11-25",
		"otro formato":   "25/11/2026",
		"vacía":          "",
	}
	for nombre, texto := range invalidas {
		if _, mensaje := validarFechaPlantacion(texto, ahora); mensaje == "" {
			t.Errorf("%s (%q): se esperaba un mensaje de error", nombre, texto)
		}
	}
}
