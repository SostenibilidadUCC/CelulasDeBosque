package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/mail"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/auth"
	"github.com/SostenibilidadUCC/CelulasDeBosque/backend/internal/respuestas"
	"github.com/jackc/pgx/v5"
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

// Roles y estados que acepta el panel de usuarios.
var (
	rolesValidos      = []string{auth.RolAdmin, auth.RolCargador, auth.RolLector}
	estadosFiltro     = []string{"invitado", "pendiente", "activo", "deshabilitado"}
	estadosAsignables = []string{"activo", "deshabilitado"} // a "pendiente" o "invitado" no se vuelve
)

// Mensajes del panel de usuarios.
const (
	mensajeSoloAdminUsuarios = "Solo el administrador puede gestionar usuarios"
	mensajeErrorUsuarios     = "No se pudo completar la operación. Probá de nuevo en unos minutos."
)

// usuarioAdmin es un usuario tal como lo ve el administrador en el panel (USR-01).
// Nunca incluye el hash de la contraseña.
type usuarioAdmin struct {
	ID          int64       `json:"id"`
	Nombre      string      `json:"nombre"`
	Email       string      `json:"email"`
	Rol         string      `json:"rol"`
	Estado      string      `json:"estado"`
	Institucion *string     `json:"institucion"` // opcional
	Lugar       *auth.Lugar `json:"lugar"`       // null para admin y lector
	CreadoEn    time.Time   `json:"creadoEn"`
}

// Columnas y JOIN para leer un usuario con su lugar (LEFT JOIN: admin y lector no tienen lugar).
const (
	columnasUsuarioAdmin = `u.id, u.nombre, u.email, u.rol, u.estado, u.institucion, u.creado_en, l.id, l.letra, l.nombre`
	desdeUsuarioAdmin    = `FROM usuarios u LEFT JOIN lugares l ON l.id = u.lugar_id`
)

// escanearUsuarioAdmin copia una fila con las columnasUsuarioAdmin a un usuarioAdmin.
// Sirve tanto para QueryRow como para cada vuelta de Query (pgx.Rows también tiene Scan).
func escanearUsuarioAdmin(fila pgx.Row) (usuarioAdmin, error) {
	var (
		u           usuarioAdmin
		lugarID     *int64
		lugarLetra  *string
		lugarNombre *string
	)
	err := fila.Scan(&u.ID, &u.Nombre, &u.Email, &u.Rol, &u.Estado, &u.Institucion, &u.CreadoEn, &lugarID, &lugarLetra, &lugarNombre)
	if err != nil {
		return u, err
	}
	// Las tres columnas del lugar son NULL juntas (LEFT JOIN sin coincidencia).
	if lugarID != nil {
		u.Lugar = &auth.Lugar{ID: *lugarID, Letra: *lugarLetra, Nombre: *lugarNombre}
	}
	return u, nil
}

// escaparLike escapa los comodines de LIKE (% y _) para que el buscador trate lo escrito como texto común.
// La barra invertida es el carácter de escape por defecto de LIKE e ILIKE en PostgreSQL.
func escaparLike(texto string) string {
	return strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_").Replace(texto)
}

// ListarUsuarios atiende GET /api/usuarios (T16, USR-01). Solo el administrador.
// Filtros opcionales por query string: rol, lugarId, estado y q (busca en nombre y email).
// Los pendientes salen primero, para que el admin los vea apenas entra; después, por nombre.
func ListarUsuarios(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !auth.EsAdmin(auth.UsuarioActual(r)) {
			respuestas.Error(w, http.StatusForbidden, mensajeSoloAdminUsuarios)
			return
		}
		consulta := r.URL.Query()

		// Cada filtro vacío queda en nil (NULL en SQL) y entonces no filtra nada.
		var rol, estado, busqueda *string
		var lugarID *int64
		if v := consulta.Get("rol"); v != "" {
			if !slices.Contains(rolesValidos, v) {
				respuestas.Error(w, http.StatusBadRequest, "El rol no es válido")
				return
			}
			rol = &v
		}
		if v := consulta.Get("estado"); v != "" {
			if !slices.Contains(estadosFiltro, v) {
				respuestas.Error(w, http.StatusBadRequest, "El estado no es válido")
				return
			}
			estado = &v
		}
		if v := consulta.Get("lugarId"); v != "" {
			id, err := strconv.ParseInt(v, 10, 64)
			if err != nil {
				respuestas.Error(w, http.StatusBadRequest, "El lugar no es válido")
				return
			}
			lugarID = &id
		}
		if v := strings.TrimSpace(consulta.Get("q")); v != "" {
			v = escaparLike(v)
			busqueda = &v
		}

		filas, err := pool.Query(r.Context(), `
			SELECT `+columnasUsuarioAdmin+` `+desdeUsuarioAdmin+`
			WHERE ($1::text IS NULL OR u.rol = $1)
			  AND ($2::bigint IS NULL OR u.lugar_id = $2)
			  AND ($3::text IS NULL OR u.estado = $3)
			  AND ($4::text IS NULL OR u.nombre ILIKE '%' || $4 || '%' OR u.email ILIKE '%' || $4 || '%')
			ORDER BY (u.estado = 'pendiente') DESC, lower(u.nombre), u.id`,
			rol, lugarID, estado, busqueda)
		if err != nil {
			log.Printf("usuarios: no se pudo listar: %v", err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeErrorUsuarios)
			return
		}
		defer filas.Close()

		usuarios := []usuarioAdmin{} // lista vacía (y no nil) para que el JSON sea [] y no null
		for filas.Next() {
			usuario, err := escanearUsuarioAdmin(filas)
			if err != nil {
				log.Printf("usuarios: no se pudo leer un usuario: %v", err)
				respuestas.Error(w, http.StatusInternalServerError, mensajeErrorUsuarios)
				return
			}
			usuarios = append(usuarios, usuario)
		}
		if err := filas.Err(); err != nil {
			log.Printf("usuarios: error al recorrer los usuarios: %v", err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeErrorUsuarios)
			return
		}

		respuestas.JSON(w, map[string]any{"usuarios": usuarios})
	}
}

// pedidoEditarUsuario es el cuerpo de PUT /api/usuarios/{id}.
// El email no está: no se puede cambiar. Nombre es un puntero para distinguir "no vino" de "vacío".
type pedidoEditarUsuario struct {
	Nombre             *string `json:"nombre"`
	Rol                string  `json:"rol"`
	LugarID            *int64  `json:"lugarId"`
	Estado             string  `json:"estado"`
	ReemplazarCargador bool    `json:"reemplazarCargador"`
}

// EditarUsuario atiende PUT /api/usuarios/{id} (T16). Solo el administrador.
// Con el mismo pedido se aprueba un pendiente (estado "activo" + rol + lugar), se edita nombre,
// rol o lugar, y se deshabilita o habilita a alguien (USR-03, USR-04, USR-05 y USR-07).
// Responde con el usuario ya actualizado.
func EditarUsuario(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		errorInterno := func(que string, err error) {
			log.Printf("usuarios: %s: %v", que, err)
			respuestas.Error(w, http.StatusInternalServerError, mensajeErrorUsuarios)
		}

		// Los permisos se revisan antes que cualquier otra cosa, incluso que el cuerpo del pedido.
		if !auth.EsAdmin(auth.UsuarioActual(r)) {
			respuestas.Error(w, http.StatusForbidden, mensajeSoloAdminUsuarios)
			return
		}
		usuarioID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			respuestas.Error(w, http.StatusBadRequest, "El usuario no es válido")
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, 4096)
		var pedido pedidoEditarUsuario
		if err := json.NewDecoder(r.Body).Decode(&pedido); err != nil {
			respuestas.Error(w, http.StatusBadRequest, "El pedido no es válido")
			return
		}

		// 1. Validaciones que no necesitan la base.
		if !slices.Contains(rolesValidos, pedido.Rol) {
			respuestas.Error(w, http.StatusBadRequest, "El rol tiene que ser administrador, cargador o lector")
			return
		}
		if !slices.Contains(estadosAsignables, pedido.Estado) {
			respuestas.Error(w, http.StatusBadRequest, "El estado tiene que ser activo o deshabilitado")
			return
		}
		var nombre *string
		if pedido.Nombre != nil {
			limpio := strings.TrimSpace(*pedido.Nombre)
			if limpio == "" || utf8.RuneCountInString(limpio) > 100 {
				respuestas.Error(w, http.StatusBadRequest, "El nombre no puede estar vacío ni tener más de 100 caracteres")
				return
			}
			nombre = &limpio // si no vino, queda nil y el UPDATE conserva el nombre actual
		}
		// Solo el cargador tiene lugar. Para admin y lector se guarda NULL aunque llegue un lugarId:
		// así nunca queda un lector o un admin "asignado" a un lugar por error.
		var lugarID *int64
		if pedido.Rol == auth.RolCargador {
			if pedido.LugarID == nil {
				respuestas.Error(w, http.StatusBadRequest, "Elegí el lugar del cargador")
				return
			}
			lugarID = pedido.LugarID
		}

		// 2. Todo lo que sigue va en UNA transacción: si algo falla, no queda nada a medias.
		tx, err := pool.Begin(ctx)
		if err != nil {
			errorInterno("no se pudo abrir la transacción", err)
			return
		}
		defer tx.Rollback(ctx) // si ya se hizo Commit, esto no hace nada

		// Candado para que dos cambios de usuarios no corran a la vez. Sin esto, dos admins que
		// se deshabilitan entre sí al mismo tiempo podrían dejar el sistema sin administradores.
		// Se libera solo al terminar la transacción. El 16 es un número cualquiera: el ticket T16.
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(16)`); err != nil {
			errorInterno("no se pudo tomar el candado", err)
			return
		}

		var rolActual, estadoActual string
		err = tx.QueryRow(ctx, `SELECT rol, estado FROM usuarios WHERE id = $1`, usuarioID).Scan(&rolActual, &estadoActual)
		if errors.Is(err, pgx.ErrNoRows) {
			respuestas.Error(w, http.StatusNotFound, "No existe ese usuario")
			return
		}
		if err != nil {
			errorInterno("no se pudo leer el usuario", err)
			return
		}

		if lugarID != nil {
			var existe bool
			if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM lugares WHERE id = $1)`, *lugarID).Scan(&existe); err != nil {
				errorInterno("no se pudo buscar el lugar", err)
				return
			}
			if !existe {
				respuestas.Error(w, http.StatusBadRequest, "No existe ese lugar")
				return
			}
		}

		// 3. USR-07: el último administrador activo no se puede deshabilitar ni cambiar de rol.
		dejaDeSerAdminActivo := rolActual == auth.RolAdmin && estadoActual == "activo" &&
			(pedido.Rol != auth.RolAdmin || pedido.Estado != "activo")
		if dejaDeSerAdminActivo {
			var otrosAdmins int
			err := tx.QueryRow(ctx,
				`SELECT count(*) FROM usuarios WHERE rol = 'admin' AND estado = 'activo' AND id <> $1`,
				usuarioID).Scan(&otrosAdmins)
			if err != nil {
				errorInterno("no se pudieron contar los administradores", err)
				return
			}
			if otrosAdmins == 0 {
				respuestas.Error(w, http.StatusConflict,
					"No se puede deshabilitar ni cambiar el rol del último administrador activo")
				return
			}
		}

		// 4. USR-03 / RN-10: un lugar tiene un solo cargador activo.
		if pedido.Rol == auth.RolCargador && pedido.Estado == "activo" {
			var actualID int64
			var actualNombre string
			err := tx.QueryRow(ctx, `
				SELECT id, nombre FROM usuarios
				WHERE rol = 'cargador' AND estado = 'activo' AND lugar_id = $1 AND id <> $2`,
				*lugarID, usuarioID).Scan(&actualID, &actualNombre)
			if err != nil && !errors.Is(err, pgx.ErrNoRows) {
				errorInterno("no se pudo buscar el cargador actual", err)
				return
			}
			if err == nil { // ya hay otro cargador activo en ese lugar
				if !pedido.ReemplazarCargador {
					// El front usa cargadorActual para ofrecer el reemplazo y reenviar con reemplazarCargador: true.
					respuestas.ErrorConDatos(w, http.StatusConflict,
						"Ese lugar ya tiene un cargador activo",
						map[string]any{"cargadorActual": map[string]any{"id": actualID, "nombre": actualNombre}})
					return
				}
				// El anterior pasa a lector y pierde el lugar (un lector no tiene lugar).
				// Va ANTES de guardar al nuevo: el índice único de RN-10 se revisa en cada UPDATE.
				_, err := tx.Exec(ctx,
					`UPDATE usuarios SET rol = 'lector', lugar_id = NULL, modificado_en = now() WHERE id = $1`,
					actualID)
				if err != nil {
					errorInterno("no se pudo pasar el cargador anterior a lector", err)
					return
				}
			}
		}

		// 5. Se guardan los cambios. El email no se toca. COALESCE deja el nombre actual si no vino uno nuevo.
		_, err = tx.Exec(ctx, `
			UPDATE usuarios
			SET nombre = COALESCE($2, nombre), rol = $3, lugar_id = $4, estado = $5, modificado_en = now()
			WHERE id = $1`,
			usuarioID, nombre, pedido.Rol, lugarID, pedido.Estado)
		if err != nil {
			errorInterno("no se pudo actualizar el usuario", err)
			return
		}

		// 6. Un usuario deshabilitado pierde sus sesiones ya mismo (USR-05), no recién en su próximo pedido.
		if pedido.Estado == "deshabilitado" {
			if _, err := tx.Exec(ctx, `DELETE FROM sesiones WHERE usuario_id = $1`, usuarioID); err != nil {
				errorInterno("no se pudieron borrar las sesiones", err)
				return
			}
		}

		if err := tx.Commit(ctx); err != nil {
			errorInterno("no se pudo confirmar la transacción", err)
			return
		}

		actualizado, err := escanearUsuarioAdmin(pool.QueryRow(ctx,
			`SELECT `+columnasUsuarioAdmin+` `+desdeUsuarioAdmin+` WHERE u.id = $1`, usuarioID))
		if err != nil {
			errorInterno("no se pudo leer el usuario actualizado", err)
			return
		}
		respuestas.JSON(w, actualizado)
	}
}
