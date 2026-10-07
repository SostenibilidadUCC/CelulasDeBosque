package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCodigoCelula(t *testing.T) {
	casos := []struct {
		letra    string
		isleta   int
		celula   int
		esperado string
	}{
		{"A", 1, 45, "A-1-45"},
		{"B", 2, 7, "B-2-7"},
		{"C", 10, 120, "C-10-120"},
	}

	for _, caso := range casos {
		if obtenido := codigoCelula(caso.letra, caso.isleta, caso.celula); obtenido != caso.esperado {
			t.Errorf("codigoCelula(%q, %d, %d) = %q, se esperaba %q", caso.letra, caso.isleta, caso.celula, obtenido, caso.esperado)
		}
	}
}

// Con un id que no es un número, responde 400 antes de tocar la base (por eso el pool puede ser nil).
func TestIsletaIDInvalido(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/isletas/{id}", Isleta(nil))

	respuesta := httptest.NewRecorder()
	mux.ServeHTTP(respuesta, httptest.NewRequest("GET", "/api/isletas/abc", nil))

	if respuesta.Code != http.StatusBadRequest {
		t.Errorf("código = %d, se esperaba %d", respuesta.Code, http.StatusBadRequest)
	}
}
