package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/auth"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/db"
)

// Con un id que no es un número, responde 400 antes de tocar la base (por eso el pool puede ser nil).
func TestFichaIDInvalido(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/celulas/{id}", Ficha(nil))

	respuesta := httptest.NewRecorder()
	mux.ServeHTTP(respuesta, httptest.NewRequest("GET", "/api/celulas/abc", nil))

	if respuesta.Code != http.StatusBadRequest {
		t.Errorf("código = %d, se esperaba %d", respuesta.Code, http.StatusBadRequest)
	}
}

func TestPuedeEditarRegistro(t *testing.T) {
	admin := &auth.Usuario{Rol: auth.RolAdmin}
	cargadorDelLugar := &auth.Usuario{Rol: auth.RolCargador, Lugar: &auth.Lugar{ID: 1}}
	cargadorDeOtroLugar := &auth.Usuario{Rol: auth.RolCargador, Lugar: &auth.Lugar{ID: 2}}
	lector := &auth.Usuario{Rol: auth.RolLector}

	casos := []struct {
		nombre   string
		usuario  *auth.Usuario
		periodo  string
		esperado bool
	}{
		{"admin, mes actual", admin, "2026-11", true},
		{"admin, mes anterior", admin, "2026-10", true},
		{"cargador del lugar, mes actual", cargadorDelLugar, "2026-11", true},
		{"cargador del lugar, mes anterior", cargadorDelLugar, "2026-10", false},
		{"cargador de otro lugar", cargadorDeOtroLugar, "2026-11", false},
		{"lector", lector, "2026-11", false},
		{"sin sesión", nil, "2026-11", false},
	}

	for _, caso := range casos {
		if obtenido := puedeEditarRegistro(caso.usuario, 1, caso.periodo, "2026-11"); obtenido != caso.esperado {
			t.Errorf("%s: puedeEditarRegistro = %v, se esperaba %v", caso.nombre, obtenido, caso.esperado)
		}
	}
}

// TestFichaConRegistros usa la base local con los datos de backend/seed/seed.sql.
// Se saltea si no está DATABASE_URL. Usa la A-1-2, que tiene 4 registros: marca uno como
// modificado y revisa que salgan todos, el modificado y los que no.
func TestFichaConRegistros(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("falta DATABASE_URL: cargá el .env y corré el seed para probar con la base")
	}

	ctx := context.Background()
	pool, err := db.Conectar(ctx)
	if err != nil {
		t.Fatalf("no se pudo conectar a la base: %v", err)
	}
	// t.Cleanup y no defer: así la conexión se cierra DESPUÉS de restaurar el registro de abajo
	// (los Cleanup corren en orden inverso: el último que se registra corre primero).
	t.Cleanup(pool.Close)

	// Los ids pueden cambiar entre seeds: la célula se busca por su código.
	var celulaID int64
	err = pool.QueryRow(ctx, `
		SELECT c.id
		FROM celulas c
		JOIN isletas i ON i.id = c.isleta_id
		JOIN lugares l ON l.id = i.lugar_id
		WHERE l.letra = 'A' AND i.numero = 1 AND c.numero = 2`).Scan(&celulaID)
	if err != nil {
		t.Fatalf("no se encontró la A-1-2 (¿corriste el seed?): %v", err)
	}

	// Cuántos registros no anulados tiene, para comparar con lo que devuelve la ficha.
	var esperados int
	err = pool.QueryRow(ctx, `SELECT count(*) FROM registros WHERE celula_id = $1 AND NOT anulado`, celulaID).Scan(&esperados)
	if err != nil {
		t.Fatalf("no se pudieron contar los registros: %v", err)
	}
	if esperados < 2 {
		t.Fatalf("la A-1-2 tiene %d registros, se necesitan al menos 2 (¿corriste el seed?)", esperados)
	}

	// Se marca el primer registro como modificado. t.Cleanup lo deja como estaba al terminar,
	// aunque el test falle, así la base queda igual que el seed.
	var registroID int64
	var modificadoEn time.Time
	err = pool.QueryRow(ctx, `
		SELECT id, modificado_en FROM registros
		WHERE celula_id = $1 AND NOT anulado
		ORDER BY periodo LIMIT 1`, celulaID).Scan(&registroID, &modificadoEn)
	if err != nil {
		t.Fatalf("no se pudo leer el primer registro: %v", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE registros SET modificado_en = creado_en + interval '1 hour' WHERE id = $1`, registroID); err != nil {
		t.Fatalf("no se pudo marcar el registro como modificado: %v", err)
	}
	t.Cleanup(func() {
		if _, err := pool.Exec(context.Background(), `UPDATE registros SET modificado_en = $2 WHERE id = $1`, registroID, modificadoEn); err != nil {
			t.Errorf("no se pudo dejar el registro %d como estaba: %v", registroID, err)
		}
	})

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/celulas/{id}", Ficha(pool))
	respuesta := httptest.NewRecorder()
	mux.ServeHTTP(respuesta, httptest.NewRequest("GET", fmt.Sprintf("/api/celulas/%d", celulaID), nil))

	if respuesta.Code != http.StatusOK {
		t.Fatalf("código = %d, se esperaba 200. Cuerpo: %s", respuesta.Code, respuesta.Body.String())
	}
	var ficha respuestaFicha
	if err := json.Unmarshal(respuesta.Body.Bytes(), &ficha); err != nil {
		t.Fatalf("no se pudo leer el JSON: %v", err)
	}

	if ficha.Codigo != "A-1-2" {
		t.Errorf("código = %q, se esperaba A-1-2", ficha.Codigo)
	}
	if len(ficha.Individuos) != 4 {
		t.Errorf("llegaron %d individuos, se esperaban 4", len(ficha.Individuos))
	}
	if len(ficha.Registros) != esperados {
		t.Fatalf("llegaron %d registros, se esperaban %d", len(ficha.Registros), esperados)
	}

	for i, reg := range ficha.Registros {
		// Del más viejo al más nuevo: cada período es posterior al anterior.
		if i > 0 && reg.Periodo <= ficha.Registros[i-1].Periodo {
			t.Errorf("registro %d: período %s no es posterior a %s", i, reg.Periodo, ficha.Registros[i-1].Periodo)
		}
		var individuos []json.RawMessage
		if err := json.Unmarshal(reg.Individuos, &individuos); err != nil || len(individuos) != 4 {
			t.Errorf("registro %d: se esperaban 4 individuos, llegaron %d (error: %v)", i, len(individuos), err)
		}
		// Sin usuario en el pedido, nadie puede editar.
		if reg.PuedeEditar {
			t.Errorf("registro %d: sin usuario, puedeEditar tendría que ser false", i)
		}
	}

	primero := ficha.Registros[0]
	if primero.ID != registroID || !primero.EsInicial {
		t.Errorf("el primer registro tendría que ser el inicial (id %d), llegó el id %d", registroID, primero.ID)
	}
	if primero.ModificadoPor == nil {
		t.Errorf("el registro modificado tendría que traer modificadoPor")
	}
	if ficha.Registros[1].ModificadoPor != nil {
		t.Errorf("un registro sin modificar tendría que traer modificadoPor en null")
	}
}
