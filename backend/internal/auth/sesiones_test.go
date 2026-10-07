package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestNuevoToken(t *testing.T) {
	primero, err := nuevoToken()
	if err != nil {
		t.Fatalf("no esperaba error: %v", err)
	}
	segundo, err := nuevoToken()
	if err != nil {
		t.Fatalf("no esperaba error: %v", err)
	}

	if len(primero) != 64 {
		t.Errorf("esperaba 64 caracteres, llegaron %d", len(primero))
	}
	if primero == segundo {
		t.Errorf("dos tokens seguidos no pueden ser iguales")
	}
}

// buscarCookie devuelve la cookie de sesión que quedó en la respuesta.
func buscarCookie(t *testing.T, w *httptest.ResponseRecorder) *http.Cookie {
	t.Helper()
	for _, c := range w.Result().Cookies() {
		if c.Name == NombreCookie {
			return c
		}
	}
	t.Fatalf("la respuesta no trae la cookie %q", NombreCookie)
	return nil
}

func TestPonerCookie(t *testing.T) {
	casos := []struct {
		nombre         string
		headerProto    string
		esperadoSecure bool
	}{
		{"sin HTTPS no lleva Secure", "", false},
		{"con X-Forwarded-Proto https lleva Secure", "https", true},
	}

	for _, caso := range casos {
		t.Run(caso.nombre, func(t *testing.T) {
			w := httptest.NewRecorder()
			r := httptest.NewRequest("POST", "/api/login", nil)
			if caso.headerProto != "" {
				r.Header.Set("X-Forwarded-Proto", caso.headerProto)
			}

			ponerCookie(w, r, "token-de-prueba", time.Now().Add(DuracionSesion))
			cookie := buscarCookie(t, w)

			if cookie.Secure != caso.esperadoSecure {
				t.Errorf("Secure: esperaba %v, llegó %v", caso.esperadoSecure, cookie.Secure)
			}
			if !cookie.HttpOnly {
				t.Errorf("la cookie tiene que ser HttpOnly")
			}
			if cookie.SameSite != http.SameSiteLaxMode {
				t.Errorf("la cookie tiene que ser SameSite=Lax")
			}
		})
	}
}

func TestBorrarCookie(t *testing.T) {
	w := httptest.NewRecorder()
	r := httptest.NewRequest("POST", "/api/logout", nil)

	borrarCookie(w, r)
	cookie := buscarCookie(t, w)

	if cookie.MaxAge >= 0 {
		t.Errorf("para borrar la cookie MaxAge tiene que ser negativo, llegó %d", cookie.MaxAge)
	}
}

func TestHashToken(t *testing.T) {
	token := "token-de-prueba"
	huella := hashToken(token)

	if len(huella) != 64 {
		t.Errorf("esperaba 64 caracteres, llegaron %d", len(huella))
	}
	if huella == token {
		t.Errorf("la huella no puede ser igual al token")
	}
	if hashToken(token) != huella {
		t.Errorf("el mismo token tiene que dar siempre la misma huella")
	}
}
