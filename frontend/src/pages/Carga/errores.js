// Qué se le muestra a la persona cuando falla el guardado del registro (T14).
// Función pura: recibe el ErrorApi de api.js y devuelve { texto, verRegistroDelMes }.
// En ningún caso se borra lo cargado: el formulario queda igual para corregir o reintentar.

const SIN_CONEXION = 'No hay conexión. Lo que cargaste sigue acá: probá de nuevo.'
const GENERICO = 'No se pudo guardar el registro. Probá de nuevo en unos minutos.'

// - fechaEsDelMesActual: si la fecha elegida es del mes en curso. Solo en ese caso, ante un 409,
//   se ofrece "Ver lo guardado": la pantalla solo sabe abrir el registro del mes en curso.
export function mensajeDeGuardado(error, { fechaEsDelMesActual }) {
  switch (error?.estado) {
    case 409: // RN-04: ya hay un registro de ese mes (el backend manda además error.datos.registroId)
      return { texto: 'Esta célula ya tiene un registro de ese mes.', verRegistroDelMes: fechaEsDelMesActual }
    case 403:
      return { texto: 'No tenés permiso para cargar en este lugar.', verRegistroDelMes: false }
    case 400: // el backend explica qué dato está mal, en español
      return { texto: error.datos?.error ?? error.message ?? GENERICO, verRegistroDelMes: false }
    case 0: // pedir() usa 0 cuando no hubo respuesta
      return { texto: SIN_CONEXION, verRegistroDelMes: false }
    default:
      return { texto: error?.message || GENERICO, verRegistroDelMes: false }
  }
}
