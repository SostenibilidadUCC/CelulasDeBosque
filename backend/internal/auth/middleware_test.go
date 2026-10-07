package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// Sin cookie, el middleware responde 401 sin tocar la base (por eso el pool puede ser nil)
// y nunca llega a ejecutar el handler protegido.
func TestRequiereSesionSinCookie(t *testing.T) {
	a := Nuevo(nil)
	llamado := false
	protegido := a.RequiereSesion(func(w http.ResponseWriter, r *http.Request) {
		llamado = true
	})

	respuesta := httptest.NewRecorder()
	protegido(respuesta, httptest.NewRequest("GET", "/api/yo", nil))

	if respuesta.Code != http.StatusUnauthorized {
		t.Errorf("código = %d, se esperaba %d", respuesta.Code, http.StatusUnauthorized)
	}
	if llamado {
		t.Error("el handler protegido no debería ejecutarse sin sesión")
	}
}
