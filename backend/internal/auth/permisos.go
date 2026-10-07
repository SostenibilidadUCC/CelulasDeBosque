package auth

// EsAdmin dice si el usuario es administrador. Un usuario nil (sin sesión) nunca lo es.
func EsAdmin(u *Usuario) bool {
	return u != nil && u.Rol == RolAdmin
}

// PuedeEditarLugar dice si el usuario puede crear células y cargar registros en ese lugar.
// El admin puede en todos; el cargador solo en el suyo; el lector y nil nunca.
func PuedeEditarLugar(u *Usuario, lugarID int64) bool {
	if EsAdmin(u) {
		return true
	}
	return u != nil && u.Rol == RolCargador && u.Lugar != nil && u.Lugar.ID == lugarID
}
