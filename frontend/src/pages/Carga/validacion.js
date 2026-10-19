// Validaciones de la carga mensual (T14). El backend vuelve a validar todo al guardar:
// esto es para avisar en pantalla antes de mandar.
import { ALTURA_MAX, ALTURA_MIN, FLORES_MAX, FLORES_MIN, alturaAnterior } from './individuos.js'

export const OBSERVACIONES_MAX = 500

function enRango(valor, minimo, maximo) {
  return Number.isInteger(valor) && valor >= minimo && valor <= maximo
}

// El primer error de un individuo con el campo al que corresponde, o null si está bien (RN-08):
// { campo: 'vivo' | 'alturaCm' | 'flores' | 'frutos' | 'plantulasNuevas', texto }.
// Vivo/muerto siempre es obligatorio; si está vivo, también los otros 4 datos.
// El campo sirve para mostrar el error pegado a su control (por ejemplo, debajo del selector de altura).
export function errorDeIndividuoConCampo(individuo) {
  if (individuo.vivo == null) return { campo: 'vivo', texto: 'Elegí si está vivo o muerto.' }
  if (individuo.vivo === false) return null
  if (!enRango(individuo.alturaCm, ALTURA_MIN, ALTURA_MAX)) {
    return { campo: 'alturaCm', texto: `Elegí la altura (de ${ALTURA_MIN} a ${ALTURA_MAX} cm).` }
  }
  if (!enRango(individuo.flores, FLORES_MIN, FLORES_MAX)) return { campo: 'flores', texto: 'Elegí la cantidad de flores.' }
  if (individuo.frutos == null) return { campo: 'frutos', texto: 'Elegí si tiene frutos.' }
  if (individuo.plantulasNuevas == null) return { campo: 'plantulasNuevas', texto: 'Elegí si hay nuevas plántulas.' }
  return null
}

// El texto del error de un individuo, o null si está bien.
export function errorDeIndividuo(individuo) {
  return errorDeIndividuoConCampo(individuo)?.texto ?? null
}

// RN-07: la foto es obligatoria. Devuelve el mensaje si falta (null o vacío), o null si está.
export function errorDeFoto(fotoId) {
  return fotoId == null || fotoId === '' ? 'Falta la foto de la célula.' : null
}

// Si se puede guardar: la fecha sin error, la foto, los 4 individuos bien y las observaciones
// dentro del largo. La usa el paso de guardar (T14 paso 6), por ejemplo:
//   const valido = esFormularioValido({ errorFecha, fotoId, individuos, observaciones })
// El aviso de cambio brusco de altura y las alturas sin cambio NO cuentan acá: no son errores.
export function esFormularioValido({ errorFecha, fotoId, individuos, observaciones }) {
  return (
    !errorFecha &&
    errorDeFoto(fotoId) === null &&
    individuos.length === 4 &&
    individuos.every((individuo) => errorDeIndividuo(individuo) === null) &&
    observaciones.length <= OBSERVACIONES_MAX
  )
}

// CAR-08: las formas de vida de los individuos VIVOS cuya altura quedó igual a la del registro
// anterior (por ejemplo [1, 4]). Los que no tienen altura anterior (no hay anterior, estaban muertos
// o son una reposición) no se cuentan. No es un error: el paso de guardar pide confirmarlo.
export function alturasSinCambio(individuos, anterior) {
  return individuos
    .filter((individuo) => {
      if (individuo.vivo !== true || individuo.alturaCm == null) return false
      const previa = alturaAnterior(anterior, individuo.formaDeVida)
      return previa != null && previa === individuo.alturaCm
    })
    .map((individuo) => individuo.formaDeVida)
}

// Lo que se manda al backend en "observaciones": un texto vacío o solo de espacios es null.
export function observacionesParaGuardar(texto) {
  const limpio = texto.trim()
  return limpio === '' ? null : limpio
}
