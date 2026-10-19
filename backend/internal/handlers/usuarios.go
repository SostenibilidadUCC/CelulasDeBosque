package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/mail"
	"strings"
	"unicode/utf8"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/respuestas"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// Largo mínimo de la contraseña. No figura en los requerimientos: 8 es el mínimo habitual.
const largoMinimoContrasena = 8

// bcrypt solo mira los primeros 72 bytes de la contraseña y la librería da error si pasa de ahí.
const largoMaximoContrasena = 72

// pedidoAcceso es el cuerpo de POST /api/solicitar-acceso.
type pedidoAcceso struct {
	Nombre      string `json:"nombre"`
	Email       string `json:"email"`
	Contrasena  string `json:"contrasena"`
	Institucion string `json:"institucion"` // opcional
}

// esEmailDuplicado dice si el error de la base es la violación del índice único del email
// (sin importar mayúsculas: usuarios_email_unico está armado sobre lower(email)).
func esEmailDuplicado(err error) bool {
	var errPg *pgconn.PgError
	// 23505 es el código de PostgreSQL para "unique_violation".
	return errors.As(err, &errPg) && errPg.Code == "23505" && errPg.ConstraintName == "usuarios_email_unico"
}

// SolicitarAcceso atiende POST /api/solicitar-acceso (T16): cualquier persona pide una cuenta.
// Es una ruta pública (sin RequiereSesion). La cuenta queda en estado "pendiente" y no puede
// iniciar sesión hasta que un administrador la apruebe. Responde 201 con {"id", "estado"}.
//
// El rol "lector" y el lugar vacío son solo un valor de relleno: la columna rol es obligatoria,
// pero el rol real lo elige el administrador al aprobar.
func SolicitarAcceso(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Un pedido real pesa pocos bytes: se corta en 4 KB, igual que el login.
		r.Body = http.MaxBytesReader(w, r.Body, 4096)

		var pedido pedidoAcceso
		if err := json.NewDecoder(r.Body).Decode(&pedido); err != nil {
			respuestas.Error(w, http.StatusBadRequest, "Completá tus datos para pedir acceso")
			return
		}
		nombre := strings.TrimSpace(pedido.Nombre)
		email := strings.TrimSpace(pedido.Email)
		institucion := strings.TrimSpace(pedido.Institucion)

		if nombre == "" {
			respuestas.Error(w, http.StatusBadRequest, "Completá tu nombre")
			return
		}
		if utf8.RuneCountInString(nombre) > 100 || utf8.RuneCountInString(institucion) > 150 {
			respuestas.Error(w, http.StatusBadRequest, "El nombre o la institución son demasiado largos")
			return
		}
		// ParseAddress acepta también "Ana <ana@x.com>": se exige que lo escrito sea solo la dirección.
		if direccion, err := mail.ParseAddress(email); err != nil || direccion.Address != email {
			respuestas.Error(w, http.StatusBadRequest, "Ingresá un email válido")
			return
		}
		// La contraseña no se recorta: los espacios del medio o del final cuentan, igual que en el login.
		if len(pedido.Contrasena) < largoMinimoContrasena || len(pedido.Contrasena) > largoMaximoContrasena {
			respuestas.Error(w, http.StatusBadRequest, "La contraseña tiene que tener entre 8 y 72 caracteres")
			return
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(pedido.Contrasena), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("usuarios: no se pudo generar el hash de la contraseña: %v", err)
			respuestas.Error(w, http.StatusInternalServerError, "No se pudo enviar el pedido. Probá de nuevo en unos minutos.")
			return
		}

		// La institución es opcional: si quedó vacía se guarda NULL y no un texto vacío.
		var institucionBD *string
		if institucion != "" {
			institucionBD = &institucion
		}

		var id int64
		err = pool.QueryRow(r.Context(), `
			INSERT INTO usuarios (nombre, email, password_hash, rol, estado, institucion)
			VALUES ($1, $2, $3, 'lector', 'pendiente', $4)
			RETURNING id`,
			nombre, email, string(hash), institucionBD).Scan(&id)
		if esEmailDuplicado(err) {
			respuestas.Error(w, http.StatusConflict, "Ya existe una cuenta con ese email")
			return
		}
		if err != nil {
			log.Printf("usuarios: no se pudo crear la cuenta pendiente: %v", err)
			respuestas.Error(w, http.StatusInternalServerError, "No se pudo enviar el pedido. Probá de nuevo en unos minutos.")
			return
		}

		respuestas.Creado(w, map[string]any{"id": id, "estado": "pendiente"})
	}
}
