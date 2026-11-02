// Textos de la pantalla Usuarios. El backend manda el rol como "admin", "cargador" o "lector";
// en pantalla se habla de lo que la persona puede hacer, nunca de "roles" ni de "estados".

// Las tres opciones que elige el administrador, en el orden en que se muestran.
export const opcionesDePermiso = [
  { valor: 'cargador', nombre: 'Cargador', explicacion: 'Carga los datos de un lugar' },
  { valor: 'lector', nombre: 'Lector', explicacion: 'Puede ver todo, no carga nada' },
  { valor: 'admin', nombre: 'Administrador', explicacion: 'Puede hacer todo, incluso aprobar usuarios' },
]

// Frase corta de lo que puede hacer un usuario, para la tarjeta.
export function describirPermisos(usuario) {
  if (usuario.rol === 'admin') return 'Administra todo'
  if (usuario.rol === 'cargador') {
    return usuario.lugar ? `Puede cargar datos en ${usuario.lugar.nombre} (${usuario.lugar.letra})` : 'Puede cargar datos (falta elegir el lugar)'
  }
  return 'Puede ver todo, no carga datos'
}

// Grupo de la pantalla al que pertenece el usuario.
// "invitado" (cuenta creada por un administrador) se cuenta como "con acceso".
export function grupoDe(usuario) {
  if (usuario.estado === 'pendiente') return 'esperando'
  if (usuario.estado === 'deshabilitado') return 'sin-acceso'
  return 'con-acceso'
}

// "18 nov 2026"
export function formatearFecha(texto) {
  return new Date(texto).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '')
}

// Para buscar sin importar mayúsculas ni tildes: "María" encuentra "maria".
export function normalizar(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
