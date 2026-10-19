// Cliente del backend. Todas las pantallas llaman al backend a través de pedir().
// Archivo compartido: solo se AGREGAN funciones, nunca se borran las de otra persona.

export class ErrorApi extends Error {
  constructor(mensaje, estado, datos = null) {
    super(mensaje)
    this.estado = estado // 400, 401, 403, 404, 409, 500, o 0 si no hay conexión
    this.datos = datos // cuerpo de la respuesta de error (por ejemplo { error, registroId } en un 409), o null
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
    throw new ErrorApi(datos?.error ?? 'Ocurrió un error inesperado. Probá de nuevo.', respuesta.status, datos)
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

// T15: ficha de la célula (datos, 4 individuos y todos sus registros)
export const obtenerCelula = (id) => pedir(`/celulas/${id}`)

// T14: carga mensual. Devuelve { celula, periodoActual, actual, anterior }:
// actual es el registro de este mes (o null) y anterior el último de un mes anterior (o null).
export const obtenerUltimoRegistro = (celulaId) => pedir(`/celulas/${celulaId}/ultimo-registro`)
// T14: guardar el registro. datos = { fecha, fotoId, observaciones, individuos } (ver pages/Carga/pedido.js).
// Las dos responden { id }. Si ya hay registro de ese mes, crearRegistro falla con un ErrorApi 409
// y el id del existente viene en error.datos?.registroId.
export const crearRegistro = (celulaId, datos) =>
  pedir(`/celulas/${celulaId}/registros`, { method: 'POST', cuerpo: datos })
export const modificarRegistro = (registroId, datos) =>
  pedir(`/registros/${registroId}`, { method: 'PUT', cuerpo: datos })
// T14: la próxima célula de la misma isleta que falta cargar: { celula: { id, codigo } } o { celula: null }.
export const obtenerSiguientePendiente = (celulaId) => pedir(`/celulas/${celulaId}/siguiente-pendiente`)

// T13: sube una foto a POST /api/fotos y devuelve { id }.
// Usa XMLHttpRequest en vez de fetch porque fetch no avisa cuánto lleva subido,
// y sin eso no hay barra de progreso. alProgresar(porcentaje) recibe un número de 0 a 100.
export function subirFoto(archivo, alProgresar = () => {}) {
  return new Promise((resolver, rechazar) => {
    const formulario = new FormData()
    formulario.append('foto', archivo, archivo.name || 'foto.jpg')

    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/fotos')
    xhr.withCredentials = true
    // Si en 60 segundos no terminó (señal muy débil), se corta para que se pueda reintentar.
    xhr.timeout = 60000

    xhr.upload.onprogress = (evento) => {
      if (evento.lengthComputable) alProgresar(Math.round((evento.loaded / evento.total) * 100))
    }

    xhr.onload = () => {
      let datos = null
      try {
        datos = JSON.parse(xhr.responseText)
      } catch {
        // La respuesta no es JSON: se usa el mensaje genérico.
      }
      if (xhr.status >= 200 && xhr.status < 300 && datos?.id != null) {
        resolver(datos)
        return
      }
      // Igual que pedir(): un 401 avisa que la sesión venció.
      if (xhr.status === 401) window.dispatchEvent(new Event(EVENTO_SESION_VENCIDA))
      rechazar(new ErrorApi(datos?.error ?? 'No se pudo subir la foto. Probá de nuevo.', xhr.status))
    }

    xhr.ontimeout = () => rechazar(new ErrorApi('La subida tardó demasiado. Revisá tu señal y probá de nuevo.', 0))
    xhr.onerror = () => rechazar(new ErrorApi('No hay conexión. Revisá tu señal y probá de nuevo.', 0))
    xhr.send(formulario)
  })
}
