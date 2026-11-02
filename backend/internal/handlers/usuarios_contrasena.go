package handlers

import (
	"crypto/rand"
	"errors"
	"log"
	"math/big"
	"net/http"
	"strconv"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/auth"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/respuestas"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// Contraseña que genera el administrador cuando alguien se la olvida (AUT-05 simplificado).
// El admin se la pasa a la persona por WhatsApp, así que es corta y sin letras que se confunden
// al leerla o dictarla: no hay 0 ni o, ni 1, l ni I. Solo minúsculas, para tipearla fácil en el celular.
// 10 caracteres de 31 posibles dan más de 10^14 combinaciones.
const (
	caracteresContrasena    = "abcdefghjkmnpqrstuvwxyz23456789"
	largoContrasenaGenerada = 10
)

// generarContrasena arma una contraseña al azar con crypto/rand, el generador seguro de Go.
// (math/rand no sirve para contraseñas: sus números se pueden adivinar.)
func generarContrasena() (string, error) {
	cantidad := big.NewInt(int64(len(caracteresContrasena)))
	contrasena := make([]byte, largoContrasenaGenerada)
	for i := range contrasena {
		posicion, err := rand.Int(rand.Reader, cantidad) // número al azar entre 0 y cantidad-1
		if err != nil {
			return "", err
		}
		contrasena[i] = caracteresContrasena[posicion.Int64()]
	}
	return string(contrasena), nil
}

// GenerarContrasenaNueva atiende POST /api/usuarios/{id}/contrasena-nueva (T16, AUT-05 simplificado).
// Solo el administrador. Genera una contraseña al azar, guarda su hash y cierra las sesiones abiertas
// de esa persona (la contraseña vieja deja de servir). Responde {"contrasena": "..."} una sola vez:
// no se guarda en texto plano en ningún lado, así que si se pierde hay que generar otra.
// Solo para usuarios activos: un pendiente todavía no fue aprobado y un deshabilitado no puede entrar.
func GenerarContrasenaNueva(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		errorInterno := func(que string, err error) {
			log.Printf("usuarios: %s: %v", que, err) // nunca se loguea la contraseña
			respuestas.Error(w, http.StatusInternalServerError, mensajeErrorUsuarios)
		}

		if !auth.EsAdmin(auth.UsuarioActual(r)) {
			respuestas.Error(w, http.StatusForbidden, mensajeSoloAdminUsuarios)
			return
		}
		usuarioID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			respuestas.Error(w, http.StatusBadRequest, "El usuario no es válido")
			return
		}

		contrasena, err := generarContrasena()
		if err != nil {
			errorInterno("no se pudo generar la contraseña", err)
			return
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(contrasena), bcrypt.DefaultCost)
		if err != nil {
			errorInterno("no se pudo calcular el hash", err)
			return
		}

		// Guardar el hash y cerrar las sesiones va junto: si una de las dos falla, no se hace ninguna.
		tx, err := pool.Begin(ctx)
		if err != nil {
			errorInterno("no se pudo abrir la transacción", err)
			return
		}
		defer tx.Rollback(ctx) // si ya se hizo Commit, esto no hace nada

		var estado string
		err = tx.QueryRow(ctx, `SELECT estado FROM usuarios WHERE id = $1 FOR UPDATE`, usuarioID).Scan(&estado)
		if errors.Is(err, pgx.ErrNoRows) {
			respuestas.Error(w, http.StatusNotFound, "No existe ese usuario")
			return
		}
		if err != nil {
			errorInterno("no se pudo leer el usuario", err)
			return
		}
		if estado != "activo" {
			respuestas.Error(w, http.StatusBadRequest, "Solo se puede generar una contraseña nueva para alguien con acceso")
			return
		}

		if _, err := tx.Exec(ctx,
			`UPDATE usuarios SET password_hash = $2, modificado_en = now() WHERE id = $1`,
			usuarioID, string(hash)); err != nil {
			errorInterno("no se pudo guardar la contraseña", err)
			return
		}
		if _, err := tx.Exec(ctx, `DELETE FROM sesiones WHERE usuario_id = $1`, usuarioID); err != nil {
			errorInterno("no se pudieron cerrar las sesiones", err)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			errorInterno("no se pudo confirmar la transacción", err)
			return
		}

		// "no-store": ni el navegador ni nadie en el camino guarda esta respuesta, porque trae la contraseña.
		w.Header().Set("Cache-Control", "no-store")
		respuestas.JSON(w, map[string]string{"contrasena": contrasena})
	}
}
