package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/db"
	"golang.org/x/crypto/bcrypt"
)

// TestLoginSegunEstado prueba qué pasa al iniciar sesión con cada estado de la cuenta.
// Crea sus propios usuarios en la base local y al terminar los borra.
// Se saltea si no está DATABASE_URL.
func TestLoginSegunEstado(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("falta DATABASE_URL: cargá el .env para probar con la base")
	}
	ctx := context.Background()
	pool, err := db.Conectar(ctx)
	if err != nil {
		t.Fatalf("no se pudo conectar a la base: %v", err)
	}
	t.Cleanup(pool.Close)

	hash, err := bcrypt.GenerateFromPassword([]byte("bosque1234"), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("no se pudo generar el hash: %v", err)
	}

	casos := []struct {
		nombre    string
		estado    string
		clave     string
		codigo    int
		mensaje   string // "" = no se revisa el mensaje
		conCookie bool
	}{
		{"activo entra", "activo", "bosque1234", http.StatusOK, "", true},
		{"pendiente con la contraseña correcta recibe el aviso", "pendiente", "bosque1234", http.StatusForbidden, MensajePendiente, false},
		{"pendiente con contraseña incorrecta recibe el error genérico", "pendiente", "otra-clave", http.StatusUnauthorized, "Email o contraseña incorrectos", false},
		{"deshabilitado con la contraseña correcta recibe su aviso", "deshabilitado", "bosque1234", http.StatusForbidden, MensajeDeshabilitado, false},
	}

	a := Nuevo(pool)
	for _, caso := range casos {
		t.Run(caso.nombre, func(t *testing.T) {
			email := "test-login-" + caso.estado + "@celulas.test"
			pool.Exec(ctx, `DELETE FROM usuarios WHERE email = $1`, email)
			_, err := pool.Exec(ctx, `
				INSERT INTO usuarios (nombre, email, password_hash, rol, estado)
				VALUES ('Usuario de prueba', $1, $2, 'lector', $3)`, email, string(hash), caso.estado)
			if err != nil {
				t.Fatalf("no se pudo crear el usuario de prueba: %v", err)
			}
			t.Cleanup(func() {
				pool.Exec(ctx, `DELETE FROM sesiones WHERE usuario_id IN (SELECT id FROM usuarios WHERE email = $1)`, email)
				pool.Exec(ctx, `DELETE FROM usuarios WHERE email = $1`, email)
			})

			cuerpo, _ := json.Marshal(map[string]string{"email": email, "contrasena": caso.clave})
			respuesta := httptest.NewRecorder()
			a.Login(respuesta, httptest.NewRequest("POST", "/api/login", bytes.NewReader(cuerpo)))

			if respuesta.Code != caso.codigo {
				t.Fatalf("código = %d, se esperaba %d. Cuerpo: %s", respuesta.Code, caso.codigo, respuesta.Body.String())
			}
			if caso.mensaje != "" {
				var datos map[string]string
				json.Unmarshal(respuesta.Body.Bytes(), &datos)
				if datos["error"] != caso.mensaje {
					t.Errorf("mensaje = %q, se esperaba %q", datos["error"], caso.mensaje)
				}
			}
			hayCookie := false
			for _, c := range respuesta.Result().Cookies() {
				if c.Name == NombreCookie && c.Value != "" {
					hayCookie = true
				}
			}
			if hayCookie != caso.conCookie {
				t.Errorf("cookie de sesión presente = %v, se esperaba %v", hayCookie, caso.conCookie)
			}
			var sesiones int
			pool.QueryRow(ctx, `SELECT count(*) FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE u.email = $1`, email).Scan(&sesiones)
			if (sesiones > 0) != caso.conCookie {
				t.Errorf("sesiones en la base = %d, no coincide con lo esperado", sesiones)
			}
		})
	}
}
