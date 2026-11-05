package handlers

import (
	"testing"
	"time"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/estados"
)

// periodoPedido decide qué mes abre la pantalla de carga: el actual (sin ?periodo=)
// o uno anterior, para editar un registro viejo desde la ficha. No hace falta la base.
func TestPeriodoPedido(t *testing.T) {
	// Noviembre de 2026 en hora de Córdoba, igual que lo calcula el handler.
	actual := estados.PeriodoActual(time.Date(2026, 11, 2, 12, 0, 0, 0, time.UTC))

	casos := []struct {
		nombre   string
		texto    string
		esperado string // "" quiere decir que tiene que dar error
	}{
		{"sin parámetro es el mes actual", "", "2026-11"},
		{"un mes anterior", "2026-09", "2026-09"},
		{"el mismo mes actual", "2026-11", "2026-11"},
		{"un mes de otro año", "2025-12", "2025-12"},
		{"un mes futuro no se puede", "2026-12", ""},
		{"formato inválido", "septiembre", ""},
		{"con día no vale", "2026-09-01", ""},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			periodo, err := periodoPedido(c.texto, actual)
			if c.esperado == "" {
				if err == nil {
					t.Fatalf("periodoPedido(%q) = %s, se esperaba un error", c.texto, periodo.Format("2006-01"))
				}
				return
			}
			if err != nil {
				t.Fatalf("periodoPedido(%q) dio error: %v", c.texto, err)
			}
			if got := periodo.Format("2006-01"); got != c.esperado {
				t.Errorf("periodoPedido(%q) = %s, se esperaba %s", c.texto, got, c.esperado)
			}
			// El SQL recibe el primer día del mes ("2026-09-01"): tiene que salir con día 1.
			if periodo.Day() != 1 {
				t.Errorf("periodoPedido(%q) no es el día 1: %s", c.texto, periodo.Format("2006-01-02"))
			}
		})
	}
}
