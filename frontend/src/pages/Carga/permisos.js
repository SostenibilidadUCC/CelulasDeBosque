// Quién puede cargar registros en un lugar (T14). Es la misma regla que auth.PuedeEditarLugar
// del backend: el admin en cualquier lugar, el cargador solo en el suyo, el lector en ninguno.
// Esto solo decide qué se muestra: el permiso real lo valida el backend al guardar.
export function puedeCargarEnLugar(usuario, lugarId) {
  if (usuario?.rol === 'admin') return true
  return usuario?.rol === 'cargador' && usuario.lugar?.id === lugarId
}
