package auth

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/respuestas"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

// hashFalso es un hash de bcrypt de una contraseña que nadie conoce.
// Cuando el email no existe, se compara contra este hash igual: así la respuesta tarda
// lo mismo que con un email real y nadie puede averiguar qué emails están registrados.
const hashFalso = "$2a$10$LF2i8RnBaqYFYqgTHJ3OWOMtyuQ1KzKoMJLiJM3zHWUxyFoq/y/vS"

// pedidoLogin es el cuerpo de POST /api/login.
type pedidoLogin struct {
	Email      string `json:"email"`
	Contrasena string `json:"contrasena"`
}

// Login valida email y contraseña, crea la sesión y devuelve el usuario (D2).
// Nunca se loguea la contraseña ni el cuerpo del pedido (RNF-SEG-03).
func (a *Auth) Login(w http.ResponseWriter, r *http.Request) {
	// Un login real pesa pocos bytes: se corta en 4 KB para que nadie mande cuerpos enormes.
	r.Body = http.MaxBytesReader(w, r.Body, 4096)

	var pedido pedidoLogin
	if err := json.NewDecoder(r.Body).Decode(&pedido); err != nil {
		respuestas.Error(w, http.StatusBadRequest, "Completá el email y la contraseña")
		return
	}
	email := strings.TrimSpace(pedido.Email)
	if email == "" || strings.TrimSpace(pedido.Contrasena) == "" {
		respuestas.Error(w, http.StatusBadRequest, "Completá el email y la contraseña")
		return
	}

	fila, err := escanearUsuario(a.pool.QueryRow(r.Context(),
		`SELECT `+columnasUsuario+` `+desdeUsuario+` WHERE lower(u.email) = lower($1)`, email))
	existe := err == nil
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		log.Printf("auth: no se pudo buscar el usuario para el login: %v", err)
		respuestas.Error(w, http.StatusInternalServerError, mensajeErrorBase)
		return
	}

	// Siempre se corre bcrypt, exista o no el usuario (ver hashFalso).
	// Un invitado (sin contraseña todavía) cae en el mismo caso que un email inexistente (D7).
	hash := hashFalso
	if existe && fila.passwordHash != nil {
		hash = *fila.passwordHash
	}
	errContrasena := bcrypt.CompareHashAndPassword([]byte(hash), []byte(pedido.Contrasena))
	if !existe || fila.passwordHash == nil || errContrasena != nil {
		respuestas.Error(w, http.StatusUnauthorized, "Email o contraseña incorrectos")
		return
	}

	// Recién con la contraseña correcta se avisa que el acceso está pausado (D8).
	if fila.estado == "deshabilitado" {
		respuestas.Error(w, http.StatusForbidden, MensajeDeshabilitado)
		return
	}

	token, err := nuevoToken()
	if err != nil {
		log.Printf("auth: no se pudo generar el token: %v", err)
		respuestas.Error(w, http.StatusInternalServerError, mensajeErrorBase)
		return
	}
	expira := time.Now().Add(DuracionSesion)
	_, err = a.pool.Exec(r.Context(),
		`INSERT INTO sesiones (token, usuario_id, expira_en) VALUES ($1, $2, $3)`,
		token, fila.ID, expira)
	if err != nil {
		log.Printf("auth: no se pudo crear la sesión: %v", err)
		respuestas.Error(w, http.StatusInternalServerError, mensajeErrorBase)
		return
	}

	ponerCookie(w, r, token, expira)
	respuestas.JSON(w, fila.Usuario)
}

// Logout cierra la sesión: borra el token de la base y la cookie del navegador (D3).
// Va envuelto en RequiereSesion, así que la cookie existe y es válida.
func (a *Auth) Logout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(NombreCookie); err == nil {
		a.borrarSesion(r.Context(), cookie.Value)
	}
	borrarCookie(w, r)
	respuestas.JSON(w, map[string]bool{"ok": true})
}

// Yo devuelve el usuario de la sesión actual (D1). El front lo usa al cargar la página.
func (a *Auth) Yo(w http.ResponseWriter, r *http.Request) {
	respuestas.JSON(w, UsuarioActual(r))
}
