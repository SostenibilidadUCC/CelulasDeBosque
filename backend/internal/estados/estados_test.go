package estados

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/db"
)

func TestEstadoCelula(t *testing.T) {
	// Cada caso: un nombre, los datos de la célula y el estado que esperamos.
	casos := []struct {
		nombre   string
		datos    DatosCelula
		esperado string
	}{
		{"sin ningún registro", DatosCelula{}, SinRegistro},
		{"con registro del período a tiempo",
			DatosCelula{TieneRegistros: true, TieneRegistroDelPeriodo: true}, AlDia},
		{"con registro del período cargado tarde",
			DatosCelula{TieneRegistros: true, TieneRegistroDelPeriodo: true, FueraDeTermino: true}, FueraDeTermino},
		{"con registros anteriores pero no del período",
			DatosCelula{TieneRegistros: true}, Pendiente},
		{"dada de baja sin registros", DatosCelula{DadaDeBaja: true}, Baja},
		{"dada de baja con registros sigue siendo baja",
			DatosCelula{DadaDeBaja: true, TieneRegistros: true, TieneRegistroDelPeriodo: true}, Baja},
		// Si el único registro está anulado, la consulta devuelve TieneRegistros = false (RN-12).
		{"único registro anulado es sin registro", DatosCelula{TieneRegistros: false}, SinRegistro},
	}

	for _, caso := range casos {
		t.Run(caso.nombre, func(t *testing.T) {
			if obtenido := EstadoCelula(caso.datos); obtenido != caso.esperado {
				t.Errorf("esperaba %q, llegó %q", caso.esperado, obtenido)
			}
		})
	}
}

func TestPeriodoActual(t *testing.T) {
	casos := []struct {
		nombre   string
		ahora    time.Time
		esperado string // el período en formato "2006-01-02"
	}{
		// 1/11 a las 02:30 en UTC es 31/10 a las 23:30 en Córdoba: todavía es octubre.
		{"fin de mes en Córdoba, ya mes siguiente en UTC",
			time.Date(2026, 11, 1, 2, 30, 0, 0, time.UTC), "2026-10-01"},
		{"mitad de mes", time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC), "2026-11-01"},
	}

	for _, caso := range casos {
		t.Run(caso.nombre, func(t *testing.T) {
			if obtenido := PeriodoActual(caso.ahora).Format("2006-01-02"); obtenido != caso.esperado {
				t.Errorf("esperaba %s, llegó %s", caso.esperado, obtenido)
			}
		})
	}
}

func TestDiasHastaVencimiento(t *testing.T) {
	casos := []struct {
		nombre   string
		ahora    time.Time
		esperado int
	}{
		{"último día del mes", time.Date(2026, 10, 31, 15, 0, 0, 0, cordoba), 0},
		{"mitad de mes", time.Date(2026, 11, 10, 15, 0, 0, 0, cordoba), 20},
		// 1/11 a las 02:30 en UTC es 31/10 en Córdoba: es el último día, no el primero.
		{"último día en Córdoba aunque en UTC ya sea el 1", time.Date(2026, 11, 1, 2, 30, 0, 0, time.UTC), 0},
	}

	for _, caso := range casos {
		t.Run(caso.nombre, func(t *testing.T) {
			if obtenido := DiasHastaVencimiento(caso.ahora); obtenido != caso.esperado {
				t.Errorf("esperaba %d, llegó %d", caso.esperado, obtenido)
			}
		})
	}
}

func TestDeCelulasSinIDs(t *testing.T) {
	// Con la lista vacía no tiene que tocar la base: por eso alcanza con pasarle un pool nil.
	// Si intentara consultar, el test se caería.
	estadoDe, err := DeCelulas(context.Background(), nil, nil, PeriodoActual(time.Now()))
	if err != nil {
		t.Fatalf("no esperaba error, llegó: %v", err)
	}
	if len(estadoDe) != 0 {
		t.Errorf("esperaba un map vacío, llegó %v", estadoDe)
	}
}

// TestDeCelulas usa la base local con los datos de backend/seed/seed.sql.
// Se saltea si no está DATABASE_URL (por ejemplo, si no cargaste el .env).
//
// Limitación: el seed arma los meses con current_date de PostgreSQL (hora UTC) y acá el
// período se calcula en hora de Córdoba. Entre las 21:00 y las 24:00 del último día del mes
// los dos pueden caer en meses distintos y este test puede fallar. Corrélo en otro horario.
func TestDeCelulas(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("falta DATABASE_URL: cargá el .env y corré el seed para probar con la base")
	}

	ctx := context.Background()
	pool, err := db.Conectar(ctx)
	if err != nil {
		t.Fatalf("no se pudo conectar a la base: %v", err)
	}
	defer pool.Close()

	// Cada caso: el código de la célula en el seed y el estado que esperamos.
	casos := []struct {
		letra    string
		isleta   int
		celula   int
		esperado string
	}{
		{"A", 2, 18, SinRegistro}, // A-2-18: no tiene ningún registro
		{"C", 1, 10, Baja},        // C-1-10: dada de baja (aunque tiene registros)
		{"A", 1, 1, AlDia},        // A-1-1: tiene el registro de este mes
		{"A", 1, 3, Pendiente},    // A-1-3: múltiplo de 3, no tiene el registro de este mes
		// A-1-7 tiene el registro del MES PASADO fuera de término, pero el de este mes a tiempo.
		// Comprueba que FueraDeTermino mira solo el registro del período actual.
		{"A", 1, 7, AlDia},
	}

	// Buscamos el id de cada célula por su código (los ids pueden cambiar entre seeds).
	ids := make([]int64, len(casos))
	for i, caso := range casos {
		err := pool.QueryRow(ctx, `
			SELECT c.id
			FROM celulas c
			JOIN isletas i ON i.id = c.isleta_id
			JOIN lugares l ON l.id = i.lugar_id
			WHERE l.letra = $1 AND i.numero = $2 AND c.numero = $3`,
			caso.letra, caso.isleta, caso.celula).Scan(&ids[i])
		if err != nil {
			t.Fatalf("no se encontró la célula %s-%d-%d (¿corriste el seed?): %v",
				caso.letra, caso.isleta, caso.celula, err)
		}
	}

	estadoDe, err := DeCelulas(ctx, pool, ids, PeriodoActual(time.Now()))
	if err != nil {
		t.Fatalf("no esperaba error, llegó: %v", err)
	}

	for i, caso := range casos {
		t.Run(fmt.Sprintf("%s-%d-%d", caso.letra, caso.isleta, caso.celula), func(t *testing.T) {
			if obtenido := estadoDe[ids[i]]; obtenido != caso.esperado {
				t.Errorf("esperaba %q, llegó %q", caso.esperado, obtenido)
			}
		})
	}
}
