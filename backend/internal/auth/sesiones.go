package auth

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"
)

const (
	// NombreCookie es el nombre de la cookie que guarda el token de sesión.
	NombreCookie = "sesion"
	// DuracionSesion es cuánto dura una sesión desde el último uso (AUT-06).
	DuracionSesion = 30 * 24 * time.Hour
)

// nuevoToken genera 32 bytes al azar con crypto/rand (seguro para claves, a diferencia de math/rand)
// y los pasa a hexadecimal: da un texto de 64 caracteres.
func nuevoToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// esHTTPS dice si el pedido llegó por HTTPS. Railway termina el HTTPS antes de llegar a Go,
// por eso también se mira el header X-Forwarded-Proto.
func esHTTPS(r *http.Request) bool {
	return r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https"
}

// ponerCookie guarda el token en una cookie HttpOnly (JavaScript no la puede leer).
// Secure solo va si el pedido es HTTPS: por wifi en http:// el celular no guardaría la cookie.
func ponerCookie(w http.ResponseWriter, r *http.Request, token string, expira time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     NombreCookie,
		Value:    token,
		Path:     "/",
		Expires:  expira,
		HttpOnly: true,
		Secure:   esHTTPS(r),
		SameSite: http.SameSiteLaxMode,
	})
}

// borrarCookie pide al navegador que elimine la cookie (MaxAge negativo).
func borrarCookie(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     NombreCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   esHTTPS(r),
		SameSite: http.SameSiteLaxMode,
	})
}
