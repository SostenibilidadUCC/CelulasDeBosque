package auth

import (
	"net/http"
	"time"
)

// UsuarioOpcional devuelve el usuario de la sesión si hay una válida, o nil si no la hay.
// A diferencia de RequiereSesion nunca responde un error: sirve para rutas que también
// pueden verse sin sesión (por ejemplo una foto de un lugar público) y que deciden ellas qué hacer.
// No renueva ni borra la sesión: eso lo hace RequiereSesion en las demás rutas.
func (a *Auth) UsuarioOpcional(r *http.Request) *Usuario {
	cookie, err := r.Cookie(NombreCookie)
	if err != nil || cookie.Value == "" {
		return nil
	}

	var expira time.Time
	fila, err := escanearUsuario(a.pool.QueryRow(r.Context(),
		`SELECT s.expira_en, `+columnasUsuario+`
		 FROM sesiones s
		 JOIN usuarios u ON u.id = s.usuario_id
		 LEFT JOIN lugares l ON l.id = u.lugar_id
		 WHERE s.token = $1`, hashToken(cookie.Value)), &expira)
	if err != nil || !expira.After(time.Now()) || fila.estado == "deshabilitado" {
		return nil // sin sesión, vencida, deshabilitada o error de la base: se trata como visitante
	}
	return &fila.Usuario
}
