package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/db"
)

// TestLugares usa la base local con los datos de backend/seed/seed.sql.
// Se saltea si no está DATABASE_URL (por ejemplo, si no cargaste el .env).
//
// Limitación: el seed arma los meses con current_date de PostgreSQL (hora UTC) y el período
// se calcula en hora de Córdoba. Entre las 21:00 y las 24:00 del último día del mes los dos
// pueden caer en meses distintos y este test puede fallar. Corrélo en otro horario.
func TestLugares(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("falta DATABASE_URL: cargá el .env y corré el seed para probar con la base")
	}

	pool, err := db.Conectar(context.Background())
	if err != nil {
		t.Fatalf("no se pudo conectar a la base: %v", err)
	}
	defer pool.Close()

	// httptest.NewRecorder hace de "navegador falso": guarda lo que responde el handler.
	// Se llama al handler directo, sin RequiereSesion, porque acá se prueban los datos, no la sesión.
	respuesta := httptest.NewRecorder()
	Lugares(pool)(respuesta, httptest.NewRequest("GET", "/api/lugares", nil))

	if respuesta.Code != http.StatusOK {
		t.Fatalf("código = %d, se esperaba 200. Cuerpo: %s", respuesta.Code, respuesta.Body.String())
	}

	var datos respuestaLugares
	if err := json.Unmarshal(respuesta.Body.Bytes(), &datos); err != nil {
		t.Fatalf("la respuesta no es el JSON esperado: %v", err)
	}

	// Cuentas a mano con el seed: el mes actual está cargado en las células cuyo número
	// no es múltiplo de 3; A-2-18 a 20 no tienen registros y C-1-10 está dada de baja.
	casos := []struct {
		letra           string
		cargadas, total int
		isletas         int
	}{
		{"A", 52, 80, 2},
		{"B", 20, 30, 2},
		{"C", 6, 9, 1},
	}

	if len(datos.Lugares) != len(casos) {
		t.Fatalf("llegaron %d lugares, se esperaban %d", len(datos.Lugares), len(casos))
	}
	for i, caso := range casos {
		t.Run(caso.letra, func(t *testing.T) {
			lugar := datos.Lugares[i] // vienen ordenados por letra
			if lugar.Letra != caso.letra {
				t.Fatalf("en la posición %d llegó el lugar %s, se esperaba %s", i, lugar.Letra, caso.letra)
			}
			if lugar.Avance.Cargadas != caso.cargadas || lugar.Avance.Total != caso.total {
				t.Errorf("avance = %d de %d, se esperaba %d de %d",
					lugar.Avance.Cargadas, lugar.Avance.Total, caso.cargadas, caso.total)
			}
			if lugar.CantidadCelulas != caso.total {
				t.Errorf("cantidadCelulas = %d, se esperaba %d", lugar.CantidadCelulas, caso.total)
			}
			if lugar.CantidadIsletas != caso.isletas || len(lugar.Isletas) != caso.isletas {
				t.Errorf("isletas = %d (lista de %d), se esperaban %d",
					lugar.CantidadIsletas, len(lugar.Isletas), caso.isletas)
			}
		})
	}
}
