package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/auth"
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
