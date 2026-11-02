package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/auth"
	"golang.org/x/crypto/bcrypt"
)

// La contraseña generada se dicta o se copia por WhatsApp: tiene que ser corta y sin letras que se confunden.
func TestGenerarContrasena(t *testing.T) {
	primera, err := generarContrasena()
	if err != nil {
		t.Fatalf("error inesperado: %v", err)
	}
	if len(primera) != largoContrasenaGenerada {
		t.Errorf("largo = %d, se esperaba %d", len(primera), largoContrasenaGenerada)
	}
	for _, letra := range primera {
		if !strings.ContainsRune(caracteresContrasena, letra) {
			t.Errorf("la contraseña %q tiene %q, que no está permitido", primera, letra)
		}
	}
	for _, confusa := range "0o1lI" {
		if strings.ContainsRune(caracteresContrasena, confusa) {
			t.Errorf("los caracteres permitidos incluyen %q, que se confunde al leerlo", confusa)
		}
	}
	segunda, _ := generarContrasena()
	if primera == segunda {
		t.Errorf("dos contraseñas seguidas salieron iguales: %q", primera)
	}
}

// POST /api/usuarios/{id}/contrasena-nueva (T16, AUT-05 simplificado).
func TestGenerarContrasenaNueva(t *testing.T) {
	pool := conectarParaUsuarios(t)
	ctx := context.Background()
	a := auth.Nuevo(pool)
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/login", a.Login)
	mux.HandleFunc("POST /api/usuarios/{id}/contrasena-nueva", a.RequiereSesion(GenerarContrasenaNueva(pool)))

	// login devuelve el código y la cookie de sesión (nil si no entró).
	login := func(email, contrasena string) (int, *http.Cookie) {
		cuerpo, _ := json.Marshal(map[string]string{"email": email, "contrasena": contrasena})
		respuesta := httptest.NewRecorder()
		mux.ServeHTTP(respuesta, httptest.NewRequest("POST", "/api/login", bytes.NewReader(cuerpo)))
		for _, c := range respuesta.Result().Cookies() {
			if c.Name == auth.NombreCookie {
				return respuesta.Code, c
			}
		}
		return respuesta.Code, nil
	}
	_, admin := login("admin@celulas.test", contrasenaPrueba)
	if admin == nil {
		t.Fatal("no se pudo iniciar sesión como admin (¿corriste el seed?)")
	}
	ruta := func(id int64) string { return fmt.Sprintf("/api/usuarios/%d/contrasena-nueva", id) }
	hashDe := func(id int64) (hash string) {
		pool.QueryRow(ctx, `SELECT password_hash FROM usuarios WHERE id = $1`, id).Scan(&hash)
		return
	}

	t.Run("sin sesión da 401", func(t *testing.T) {
		id := crearUsuarioPrueba(t, pool, "Sol Sinsesion", "lector", "activo", nil)
		if codigo, _ := pedir(mux, nil, "POST", ruta(id), nil); codigo != http.StatusUnauthorized {
			t.Errorf("código = %d, se esperaba 401", codigo)
		}
	})

	t.Run("quien no es admin recibe 403 y la contraseña no cambia", func(t *testing.T) {
		crearUsuarioPrueba(t, pool, "Nico Noadmin", "lector", "activo", nil)
		otro := crearUsuarioPrueba(t, pool, "Olga Objetivo", "lector", "activo", nil)
		_, lector := login(emailDe("Nico Noadmin"), contrasenaPrueba)
		antes := hashDe(otro)
		if codigo, _ := pedir(mux, lector, "POST", ruta(otro), nil); codigo != http.StatusForbidden {
			t.Errorf("código = %d, se esperaba 403", codigo)
		}
		if hashDe(otro) != antes {
			t.Error("la contraseña cambió aunque el pedido fue rechazado")
		}
	})

	t.Run("el admin genera una contraseña que sirve para entrar y la vieja deja de servir", func(t *testing.T) {
		id := crearUsuarioPrueba(t, pool, "Clara Contrasena", "lector", "activo", nil)
		if codigo, _ := login(emailDe("Clara Contrasena"), contrasenaPrueba); codigo != http.StatusOK {
			t.Fatalf("antes del cambio no pudo entrar (código %d)", codigo)
		}

		codigo, datos := pedir(mux, admin, "POST", ruta(id), nil)
		if codigo != http.StatusOK {
			t.Fatalf("código = %d, se esperaba 200 (%v)", codigo, datos)
		}
		nueva, _ := datos["contrasena"].(string)
		if len(nueva) != largoContrasenaGenerada {
			t.Fatalf("la respuesta no trae una contraseña válida: %v", datos)
		}
		if bcrypt.CompareHashAndPassword([]byte(hashDe(id)), []byte(nueva)) != nil {
			t.Error("en la base no quedó guardado el hash de la contraseña nueva")
		}
		if codigo, _ := login(emailDe("Clara Contrasena"), contrasenaPrueba); codigo == http.StatusOK {
			t.Error("la contraseña vieja todavía sirve para entrar")
		}
		if codigo, cookie := login(emailDe("Clara Contrasena"), nueva); codigo != http.StatusOK || cookie == nil {
			t.Errorf("con la contraseña nueva no pudo entrar (código %d)", codigo)
		}
	})

	t.Run("cierra las sesiones abiertas de esa persona", func(t *testing.T) {
		id := crearUsuarioPrueba(t, pool, "Sergio Sesiones", "lector", "activo", nil)
		login(emailDe("Sergio Sesiones"), contrasenaPrueba)
		if codigo, _ := pedir(mux, admin, "POST", ruta(id), nil); codigo != http.StatusOK {
			t.Fatalf("código = %d, se esperaba 200", codigo)
		}
		var sesiones int
		pool.QueryRow(ctx, `SELECT count(*) FROM sesiones WHERE usuario_id = $1`, id).Scan(&sesiones)
		if sesiones != 0 {
			t.Errorf("quedaron %d sesiones abiertas, se esperaba ninguna", sesiones)
		}
	})

	t.Run("a quien no tiene acceso no se le genera (400) y su contraseña no cambia", func(t *testing.T) {
		for _, estado := range []string{"pendiente", "deshabilitado"} {
			nombre := "Pia " + estado
			id := crearUsuarioPrueba(t, pool, nombre, "lector", estado, nil)
			antes := hashDe(id)
			if codigo, _ := pedir(mux, admin, "POST", ruta(id), nil); codigo != http.StatusBadRequest {
				t.Errorf("%s: código = %d, se esperaba 400", estado, codigo)
			}
			if hashDe(id) != antes {
				t.Errorf("%s: la contraseña cambió", estado)
			}
		}
	})

	t.Run("usuario inexistente da 404 e id inválido da 400", func(t *testing.T) {
		if codigo, _ := pedir(mux, admin, "POST", ruta(999999), nil); codigo != http.StatusNotFound {
			t.Errorf("inexistente: código = %d, se esperaba 404", codigo)
		}
		if codigo, _ := pedir(mux, admin, "POST", "/api/usuarios/abc/contrasena-nueva", nil); codigo != http.StatusBadRequest {
			t.Errorf("id inválido: código = %d, se esperaba 400", codigo)
		}
	})
}
