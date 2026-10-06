package respuestas

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestJSON(t *testing.T) {
	// httptest.NewRecorder es un ResponseWriter "de mentira" que guarda todo lo que se escribe.
	w := httptest.NewRecorder()

	JSON(w, map[string]bool{"ok": true})

	if w.Code != http.StatusOK {
		t.Errorf("código: esperaba %d, llegó %d", http.StatusOK, w.Code)
	}
	if tipo := w.Header().Get("Content-Type"); tipo != "application/json" {
		t.Errorf("Content-Type: esperaba application/json, llegó %q", tipo)
	}

	var cuerpo map[string]bool
	if err := json.Unmarshal(w.Body.Bytes(), &cuerpo); err != nil {
		t.Fatalf("el cuerpo no es JSON válido: %v", err)
	}
	if !cuerpo["ok"] {
		t.Errorf("cuerpo: esperaba {\"ok\": true}, llegó %s", w.Body.String())
	}
}

func TestError(t *testing.T) {
	w := httptest.NewRecorder()

	Error(w, http.StatusNotFound, "No encontramos esa célula")

	if w.Code != http.StatusNotFound {
		t.Errorf("código: esperaba %d, llegó %d", http.StatusNotFound, w.Code)
	}
	if tipo := w.Header().Get("Content-Type"); tipo != "application/json" {
		t.Errorf("Content-Type: esperaba application/json, llegó %q", tipo)
	}

	var cuerpo map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &cuerpo); err != nil {
		t.Fatalf("el cuerpo no es JSON válido: %v", err)
	}
	if cuerpo["error"] != "No encontramos esa célula" {
		t.Errorf("cuerpo: esperaba el mensaje de error, llegó %s", w.Body.String())
	}
}
