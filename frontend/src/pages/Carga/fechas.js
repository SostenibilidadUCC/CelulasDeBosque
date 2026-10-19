// Ayudas de fechas de la carga mensual (T14). Todas las fechas son texto "YYYY-MM-DD",
// igual que en el JSON del backend. Así se pueden comparar como texto ("2026-10-05" < "2026-10-18")
// y la zona horaria del celular nunca corre un día.

// Intl.DateTimeFormat formatea fechas en la zona horaria que le pidas. El formato 'en-CA'
// da justo "YYYY-MM-DD", que es lo que usa el backend.
const formatoHoyCordoba = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Cordoba',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const formatoMesLargo = new Intl.DateTimeFormat('es-AR', { month: 'long' })

// Fecha de hoy en hora de Córdoba, aunque el celular tenga otra zona horaria.
export function hoyEnCordoba() {
  return formatoHoyCordoba.format(new Date())
}

// "2026-10-18" → "2026-10" (el período es el mes de la fecha).
export function periodoDeFecha(fecha) {
  return fecha.slice(0, 7)
}

// "2026-10" → "octubre 2026" (formato de períodos, frontend/CLAUDE.md).
export function periodoEnTexto(periodo) {
  const [anio, mes] = periodo.split('-').map(Number)
  return `${formatoMesLargo.format(new Date(anio, mes - 1, 1))} ${anio}`
}

// "2026-09" → "septiembre" (para usar dentro de una frase).
export function mesEnMinuscula(periodo) {
  const [anio, mes] = periodo.split('-').map(Number)
  return formatoMesLargo.format(new Date(anio, mes - 1, 1))
}

// "2026-09" → "Septiembre" (al principio de una línea, como en "Septiembre: 173 cm").
export function nombreDelMes(periodo) {
  const mes = mesEnMinuscula(periodo)
  return mes.charAt(0).toUpperCase() + mes.slice(1)
}

// "2026-10-18" → "18/10/2026" (formato de fechas en formularios).
export function fechaEnTexto(fecha) {
  const [anio, mes, dia] = fecha.split('-')
  return `${dia}/${mes}/${anio}`
}

// "2026-10" → "2026-10-31". El "día 0" del mes siguiente es, para JavaScript, el último de este mes.
function ultimoDiaDelMes(periodo) {
  const [anio, mes] = periodo.split('-').map(Number)
  const dia = new Date(anio, mes, 0).getDate()
  return `${periodo}-${String(dia).padStart(2, '0')}`
}

// Las fechas que se pueden elegir (RN-06), como { min, max }.
// - Registro nuevo: desde la plantación hasta hoy.
// - Editando: solo dentro del mes del registro (del día 1 hasta hoy o fin de mes, lo que sea menor),
//   y tampoco antes de la plantación.
export function rangoDeFechas({ fechaPlantacion, registroEditado, hoy }) {
  if (!registroEditado) return { min: fechaPlantacion, max: hoy }
  const primerDia = `${registroEditado.periodo}-01`
  const finDeMes = ultimoDiaDelMes(registroEditado.periodo)
  return {
    min: primerDia > fechaPlantacion ? primerDia : fechaPlantacion,
    max: finDeMes < hoy ? finDeMes : hoy,
  }
}

// Revisa la fecha elegida y devuelve el mensaje de error, o null si está bien.
// El calendario del celular ya usa min y max, pero Safari de iPhone no siempre los respeta.
export function validarFecha(fecha, { fechaPlantacion, registroEditado, hoy }) {
  if (!fecha) return 'Elegí la fecha de medición.'
  if (fecha > hoy) return 'La fecha no puede ser futura.'
  if (fecha < fechaPlantacion) {
    return `La fecha no puede ser anterior a la plantación (${fechaEnTexto(fechaPlantacion)}).`
  }
  if (registroEditado && periodoDeFecha(fecha) !== registroEditado.periodo) {
    return `Estás editando el registro de ${periodoEnTexto(registroEditado.periodo)}: elegí una fecha de ese mes.`
  }
  return null
}
