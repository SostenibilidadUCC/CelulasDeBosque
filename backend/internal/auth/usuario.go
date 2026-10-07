// Package auth reúne todo lo de sesiones y permisos: quién es el usuario y qué puede hacer.
package auth

// Roles posibles de un usuario. Son iguales al CHECK de la tabla usuarios.
const (
	RolAdmin    = "admin"
	RolCargador = "cargador"
	RolLector   = "lector"
)

// EmailContacto es el mail al que escribe alguien con el acceso pausado (AUT-03).
const EmailContacto = "sostenible@ucc.edu.ar" // TODO: confirmar con la clienta

// MensajeDeshabilitado es lo que ve un usuario deshabilitado al intentar entrar.
const MensajeDeshabilitado = "Tu acceso está pausado. Para volver a ingresar, escribí a " + EmailContacto

// Lugar es la institución (universidad o colegio) a la que pertenece un cargador.
type Lugar struct {
	ID     int64  `json:"id"`
	Letra  string `json:"letra"`
	Nombre string `json:"nombre"`
}

// Usuario es lo que el front recibe en /api/login y /api/yo.
// Lugar es un puntero porque el admin y el lector no tienen: sale como null en el JSON.
type Usuario struct {
	ID     int64  `json:"id"`
	Nombre string `json:"nombre"`
	Email  string `json:"email"`
	Rol    string `json:"rol"`
	Lugar  *Lugar `json:"lugar"`
}
