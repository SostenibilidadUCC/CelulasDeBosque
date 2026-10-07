package auth

import (
	"context"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/respuestas"
	"github.com/jackc/pgx/v5"
)

// claveContexto es la clave privada con la que se guarda el usuario en el contexto del pedido.
// Al ser un tipo propio de este paquete, ningún otro paquete puede pisarla por error.
type claveContexto struct{}

// UsuarioActual devuelve el usuario de la sesión. Nunca es nil si la ruta usa RequiereSesion.
func UsuarioActual(r *http.Request) *Usuario {
	usuario, _ := r.Context().Value(claveContexto{}).(*Usuario)
	return usuario
}

// RequiereSesion envuelve un handler y lo deja pasar solo si hay una sesión válida.
// Uso en main.go: mux.HandleFunc("GET /api/yo", a.RequiereSesion(a.Yo))
func (a *Auth) RequiereSesion(siguiente http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// 1. Sin cookie no hay sesión.
		cookie, err := r.Cookie(NombreCookie)
		if err != nil || cookie.Value == "" {
			respuestas.Error(w, http.StatusUnauthorized, mensajeSinSesion)
			return
		}
		token := cookie.Value

		// 2. Una sola consulta trae la sesión, su vencimiento y el usuario con su lugar.
		var expira time.Time
		fila, err := escanearUsuario(a.pool.QueryRow(r.Context(),
			`SELECT s.expira_en, `+columnasUsuario+`
			 FROM sesiones s
			 JOIN usuarios u ON u.id = s.usuario_id
			 LEFT JOIN lugares l ON l.id = u.lugar_id
			 WHERE s.token = $1`, token), &expira)
		if errors.Is(err, pgx.ErrNoRows) {
			// El token no existe (sesión cerrada o inventada).
			borrarCookie(w, r)
			respuestas.Error(w, http.StatusUnauthorized, mensajeSinSesion)
			return
		}
		if err != nil {
			log.Printf("auth: no se pudo leer la sesión: %v", err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeErrorBase)
			return
		}
		if !expira.After(time.Now()) {
			a.borrarSesion(r.Context(), token)
			borrarCookie(w, r)
			respuestas.Error(w, http.StatusUnauthorized, mensajeSinSesion)
			return
		}

		// 3. Un usuario deshabilitado pierde todas sus sesiones en su próximo pedido (D9).
		if fila.estado == "deshabilitado" {
			if _, err := a.pool.Exec(r.Context(), `DELETE FROM sesiones WHERE usuario_id = $1`, fila.ID); err != nil {
				log.Printf("auth: no se pudieron borrar las sesiones del usuario %d: %v", fila.ID, err)
			}
			borrarCookie(w, r)
			respuestas.Error(w, http.StatusForbidden, MensajeDeshabilitado)
			return
		}

		// 4. Sesión deslizante (D4): si le quedan menos de 29 días, se renueva a 30.
		// Así se escribe en la base como máximo una vez por día y no en cada pedido.
		if time.Until(expira) < DuracionSesion-24*time.Hour {
			nuevaExpira := time.Now().Add(DuracionSesion)
			if _, err := a.pool.Exec(r.Context(), `UPDATE sesiones SET expira_en = $2 WHERE token = $1`, token, nuevaExpira); err != nil {
				// No es grave: la sesión sigue valiendo, se intentará renovar en el próximo pedido.
				log.Printf("auth: no se pudo renovar la sesión: %v", err)
			} else {
				ponerCookie(w, r, token, nuevaExpira)
			}
		}

		// 5. Se guarda el usuario en el contexto para que el handler lo lea con UsuarioActual.
		ctx := context.WithValue(r.Context(), claveContexto{}, &fila.Usuario)
		siguiente(w, r.WithContext(ctx))
	}
}

// borrarSesion elimina una sesión por su token. Si falla, solo queda en el log.
func (a *Auth) borrarSesion(ctx context.Context, token string) {
	if _, err := a.pool.Exec(ctx, `DELETE FROM sesiones WHERE token = $1`, token); err != nil {
		log.Printf("auth: no se pudo borrar la sesión: %v", err)
	}
}
