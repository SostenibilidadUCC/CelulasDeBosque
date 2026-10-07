package auth

import (
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Mensajes que ve la persona en pantalla.
const (
	mensajeSinSesion = "Iniciá sesión para continuar"
	mensajeErrorBase = "Ocurrió un error. Probá de nuevo en unos minutos."
)

// Auth agrupa lo que necesitan el login, el logout y el middleware: la conexión a la base.
// Se crea una sola vez en main.go con Nuevo.
type Auth struct {
	pool *pgxpool.Pool
}

// Nuevo crea el Auth con el pool de conexiones compartido.
func Nuevo(pool *pgxpool.Pool) *Auth {
	return &Auth{pool: pool}
}

// filaUsuario es un usuario tal como sale de la base: el Usuario público
// más los datos que el front nunca recibe (hash de la contraseña y estado).
type filaUsuario struct {
	Usuario
	passwordHash *string // NULL si el usuario está invitado y todavía no definió contraseña
	estado       string  // 'invitado', 'activo' o 'deshabilitado'
}

// Columnas y JOIN comunes para leer un usuario con su lugar.
// Es LEFT JOIN porque el admin y el lector no tienen lugar (lugar_id es NULL).
const (
	columnasUsuario = `u.id, u.nombre, u.email, u.rol, u.estado, u.password_hash, l.id, l.letra, l.nombre`
	desdeUsuario    = `FROM usuarios u LEFT JOIN lugares l ON l.id = u.lugar_id`
)

// escanearUsuario copia una fila con las columnasUsuario a un filaUsuario.
// "antes" son destinos extra para columnas que la consulta pone ANTES de las del usuario
// (por ejemplo expira_en en el middleware).
func escanearUsuario(fila pgx.Row, antes ...any) (*filaUsuario, error) {
	var (
		u           filaUsuario
		lugarID     *int64
		lugarLetra  *string
		lugarNombre *string
	)
	destinos := append(antes, &u.ID, &u.Nombre, &u.Email, &u.Rol, &u.estado, &u.passwordHash, &lugarID, &lugarLetra, &lugarNombre)
	if err := fila.Scan(destinos...); err != nil {
		return nil, err
	}
	// Las tres columnas del lugar son NULL juntas (LEFT JOIN sin coincidencia).
	if lugarID != nil {
		u.Lugar = &Lugar{ID: *lugarID, Letra: *lugarLetra, Nombre: *lugarNombre}
	}
	return &u, nil
}
