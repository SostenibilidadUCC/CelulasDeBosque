package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestInterpretarBusqueda(t *testing.T) {
	// Cada caso: el texto del buscador, qué se espera entender y si se entiende o no.
	// 0 en isleta o numero quiere decir "sin ese filtro" (nil).
	casos := []struct {
		nombre string
		q      string
		isleta int
		numero int
		ok     bool
	}{
		{"vacío: sin filtro", "", 0, 0, true},
		{"solo espacios: sin filtro", "   ", 0, 0, true},
		{"solo el número", "45", 0, 45, true},
		{"código completo", "A-1-45", 1, 45, true},
		{"código en minúscula", "a-1-45", 1, 45, true},
		{"código con espacios alrededor", "  A-1-45 ", 1, 45, true},
		{"letra de otro lugar", "B-1-45", 0, 0, false},
		{"falta el número de célula", "A-1", 0, 0, false},
		{"código de individuo", "A-1-45-1", 0, 0, false},
		{"texto cualquiera", "hola", 0, 0, false},
		{"número negativo", "-5", 0, 0, false},
		{"número con signo", "+5", 0, 0, false},
		{"cero", "0", 0, 0, false},
		{"isleta que no es número", "A-x-45", 0, 0, false},
	}

	for _, caso := range casos {
		t.Run(caso.nombre, func(t *testing.T) {
			b, ok := interpretarBusqueda(caso.q, "A")
			if ok != caso.ok {
				t.Fatalf("ok = %v, se esperaba %v", ok, caso.ok)
			}
			if obtenido := valorOCero(b.isleta); obtenido != caso.isleta {
				t.Errorf("isleta = %d, se esperaba %d", obtenido, caso.isleta)
			}
			if obtenido := valorOCero(b.numero); obtenido != caso.numero {
				t.Errorf("numero = %d, se esperaba %d", obtenido, caso.numero)
			}
		})
	}
}

// valorOCero devuelve el número al que apunta p, o 0 si p es nil.
func valorOCero(p *int) int {
	if p == nil {
		return 0
	}
	return *p
}

// pedirCelulas llama al handler como lo haría el navegador y devuelve el código y la respuesta.
// Hace falta pasar por un mux para que r.PathValue("id") funcione.
func pedirCelulas(t *testing.T, pool *pgxpool.Pool, ruta string) (int, respuestaCelulasDeLugar) {
	t.Helper() // si falla, Go marca la línea del test que la llamó, no esta
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/lugares/{id}/celulas", CelulasDeLugar(pool))

	respuesta := httptest.NewRecorder()
	mux.ServeHTTP(respuesta, httptest.NewRequest("GET", ruta, nil))

	var datos respuestaCelulasDeLugar
	if respuesta.Code == http.StatusOK {
		if err := json.Unmarshal(respuesta.Body.Bytes(), &datos); err != nil {
			t.Fatalf("la respuesta no es el JSON esperado: %v", err)
		}
	}
	return respuesta.Code, datos
}

// Los pedidos inválidos responden 400 antes de tocar la base (por eso el pool puede ser nil).
func TestCelulasDeLugarPedidoInvalido(t *testing.T) {
	casos := []struct {
		nombre string
		ruta   string
	}{
		{"id de lugar que no es número", "/api/lugares/abc/celulas"},
		{"isleta que no es número", "/api/lugares/1/celulas?isleta=x"},
		{"estado que no existe", "/api/lugares/1/celulas?estado=perdida"},
	}

	for _, caso := range casos {
		t.Run(caso.nombre, func(t *testing.T) {
			if codigo, _ := pedirCelulas(t, nil, caso.ruta); codigo != http.StatusBadRequest {
				t.Errorf("código = %d, se esperaba %d", codigo, http.StatusBadRequest)
			}
		})
	}
}

// TestCelulasDeLugar usa la base local con los datos de backend/seed/seed.sql.
// Se saltea si no está DATABASE_URL. Misma limitación de fin de mes que TestLugares.
func TestCelulasDeLugar(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("falta DATABASE_URL: cargá el .env y corré el seed para probar con la base")
	}

	ctx := context.Background()
	pool, err := db.Conectar(ctx)
	if err != nil {
		t.Fatalf("no se pudo conectar a la base: %v", err)
	}
	defer pool.Close()

	// Los ids pueden cambiar entre seeds: se buscan por letra y número.
	var lugarA, isletaA2 int64
	err = pool.QueryRow(ctx, `
		SELECT l.id, i.id
		FROM lugares l
		JOIN isletas i ON i.lugar_id = l.id
		WHERE l.letra = 'A' AND i.numero = 2`).Scan(&lugarA, &isletaA2)
	if err != nil {
		t.Fatalf("no se encontró la isleta A-2 (¿corriste el seed?): %v", err)
	}
	base := fmt.Sprintf("/api/lugares/%d/celulas", lugarA)

	t.Run("lugar que no existe da 404", func(t *testing.T) {
		if codigo, _ := pedirCelulas(t, pool, "/api/lugares/999999/celulas"); codigo != http.StatusNotFound {
			t.Errorf("código = %d, se esperaba 404", codigo)
		}
	})

	t.Run("sin filtros vienen las 80 células, ordenadas", func(t *testing.T) {
		_, datos := pedirCelulas(t, pool, base)
		if len(datos.Celulas) != 80 {
			t.Fatalf("llegaron %d células, se esperaban 80", len(datos.Celulas))
		}
		if datos.Celulas[0].Codigo != "A-1-1" || datos.Celulas[79].Codigo != "A-2-20" {
			t.Errorf("orden inesperado: primera %s, última %s", datos.Celulas[0].Codigo, datos.Celulas[79].Codigo)
		}
		if datos.PuedeEditar {
			t.Errorf("sin usuario, puedeEditar tendría que ser false")
		}
	})

	t.Run("código completo A-1-3 es pendiente", func(t *testing.T) {
		_, datos := pedirCelulas(t, pool, base+"?q=a-1-3")
		if len(datos.Celulas) != 1 {
			t.Fatalf("llegaron %d células, se esperaba 1", len(datos.Celulas))
		}
		c := datos.Celulas[0]
		if c.Codigo != "A-1-3" || c.Estado != "pendiente" {
			t.Errorf("llegó %s con estado %q, se esperaba A-1-3 pendiente", c.Codigo, c.Estado)
		}
		if c.UltimoRegistro == nil {
			t.Errorf("A-1-3 tiene registros de meses anteriores: ultimoRegistro no tendría que ser null")
		}
	})

	t.Run("solo el número 45 busca en todas las isletas", func(t *testing.T) {
		// A-2 tiene 20 células, así que el 45 solo existe en A-1.
		_, datos := pedirCelulas(t, pool, base+"?q=45")
		if len(datos.Celulas) != 1 || datos.Celulas[0].Codigo != "A-1-45" {
			t.Errorf("se esperaba solo A-1-45, llegaron %d células", len(datos.Celulas))
		}
	})

	t.Run("letra de otro lugar da lista vacía", func(t *testing.T) {
		codigo, datos := pedirCelulas(t, pool, base+"?q=B-1-3")
		if codigo != http.StatusOK || len(datos.Celulas) != 0 {
			t.Errorf("código %d con %d células, se esperaba 200 y lista vacía", codigo, len(datos.Celulas))
		}
	})

	t.Run("filtro por isleta", func(t *testing.T) {
		_, datos := pedirCelulas(t, pool, fmt.Sprintf("%s?isleta=%d", base, isletaA2))
		if len(datos.Celulas) != 20 {
			t.Errorf("llegaron %d células, se esperaban las 20 de A-2", len(datos.Celulas))
		}
	})

	t.Run("filtro sin-registro: A-2-18, 19 y 20 con individuos sin datos", func(t *testing.T) {
		_, datos := pedirCelulas(t, pool, base+"?estado=sin-registro")
		esperados := []string{"A-2-18", "A-2-19", "A-2-20"}
		if len(datos.Celulas) != len(esperados) {
			t.Fatalf("llegaron %d células, se esperaban %d", len(datos.Celulas), len(esperados))
		}
		for i, c := range datos.Celulas {
			if c.Codigo != esperados[i] {
				t.Errorf("posición %d: llegó %s, se esperaba %s", i, c.Codigo, esperados[i])
			}
			if c.UltimoRegistro != nil {
				t.Errorf("%s no tiene registros: ultimoRegistro tendría que ser null", c.Codigo)
			}
			// Los 4 individuos vienen igual, con vivo en null.
			var individuos []struct {
				FormaDeVida int   `json:"formaDeVida"`
				Vivo        *bool `json:"vivo"`
			}
			if err := json.Unmarshal(c.Individuos, &individuos); err != nil {
				t.Fatalf("individuos de %s no es JSON válido: %v", c.Codigo, err)
			}
			if len(individuos) != 4 {
				t.Errorf("%s: llegaron %d individuos, se esperaban 4", c.Codigo, len(individuos))
			}
			for _, ind := range individuos {
				if ind.Vivo != nil {
					t.Errorf("%s: el individuo %d tendría que tener vivo null", c.Codigo, ind.FormaDeVida)
				}
			}
		}
	})
}
