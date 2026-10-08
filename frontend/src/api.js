// Cliente del backend. Todas las pantallas llaman al backend a través de pedir().
// Archivo compartido: solo se AGREGAN funciones, nunca se borran las de otra persona.

export class ErrorApi extends Error {
  constructor(mensaje, estado) {
    super(mensaje)
    this.estado = estado // 400, 401, 403, 404, 409, 500, o 0 si no hay conexión
  }
}

/**
 * Ejemplos:
 *   pedir('/lugares')
 *   pedir('/celulas/45/registros', { method: 'POST', cuerpo: { fecha: '2026-11-18' } })
 *   pedir('/fotos', { method: 'POST', cuerpo: formData })  // FormData se manda tal cual
 */
export async function pedir(ruta, { cuerpo, headers, ...opciones } = {}) {
  const esJson = cuerpo !== undefined && !(cuerpo instanceof FormData)

  let respuesta
  try {
    respuesta = await fetch(`/api${ruta}`, {
      credentials: 'include',
      headers: esJson ? { 'Content-Type': 'application/json', ...headers } : headers,
      body: esJson ? JSON.stringify(cuerpo) : cuerpo,
      ...opciones,
    })
  } catch {
    throw new ErrorApi('No hay conexión. Revisá tu señal y probá de nuevo.', 0)
  }

  const datos = respuesta.status === 204 ? null : await respuesta.json().catch(() => null)

  if (!respuesta.ok) {
    // T10: un 401 en cualquier pedido significa que la sesión venció o se cerró: se avisa a
    // ProveedorSesion para que mande al login. /login queda afuera: ahí un 401 es "contraseña incorrecta".
    if (respuesta.status === 401 && ruta !== '/login') {
      window.dispatchEvent(new Event(EVENTO_SESION_VENCIDA))
    }
    throw new ErrorApi(datos?.error ?? 'Ocurrió un error inesperado. Probá de nuevo.', respuesta.status)
  }
  return datos
}

// T10: sesión
export const iniciarSesion = (email, contrasena) =>
  pedir('/login', { method: 'POST', cuerpo: { email, contrasena } })
export const cerrarSesion = () => pedir('/logout', { method: 'POST' })
export const obtenerYo = () => pedir('/yo')

// Nombre del evento que dispara pedir() cuando recibe un 401. Lo escucha ProveedorSesion.
export const EVENTO_SESION_VENCIDA = 'sesion-vencida'

// T12: plano de la isleta
export const obtenerIsleta = (id) => pedir(`/isletas/${id}`)

// T11: inicio y explorar células
export const obtenerLugares = () => pedir('/lugares')
// filtros: { isleta, estado, q }. Los vacíos no se mandan.
// URLSearchParams arma "isleta=1&q=A-1-45" y escapa los caracteres especiales.
export const obtenerCelulasDeLugar = (lugarId, filtros = {}) => {
  const parametros = new URLSearchParams()
  for (const [nombre, valor] of Object.entries(filtros)) {
    if (valor) parametros.set(nombre, valor)
  }
  const texto = parametros.toString()
  return pedir(`/lugares/${lugarId}/celulas${texto ? `?${texto}` : ''}`)
}
