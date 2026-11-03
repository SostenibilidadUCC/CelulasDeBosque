// Ayudas de formato que usan los componentes de la ficha (T15).

const formatoMes = new Intl.DateTimeFormat('es-AR', { month: 'short' })

// 11 → "nov". Intl le pone punto a algunos meses ("sept."), por eso se le saca.
function nombreMes(anio, mes) {
  return formatoMes.format(new Date(anio, mes - 1, 1)).replace('.', '')
}

// "2026-11-18" → "18 nov 2026" (formato de fechas en tarjetas, frontend/CLAUDE.md).
// La fecha se arma con sus partes para que la zona horaria no la corra un día.
export function fechaCorta(texto) {
  const [anio, mes, dia] = texto.split('-').map(Number)
  return `${dia} ${nombreMes(anio, mes)} ${anio}`
}

// "2026-11" → "nov" (eje X de los gráficos).
export function mesCorto(periodo) {
  const [anio, mes] = periodo.split('-').map(Number)
  return nombreMes(anio, mes)
}

// Color de cada forma de vida para los gráficos. Son los tokens de index.css:
// var(--color-arbol) toma el valor de ahí, así no hay colores sueltos en hexadecimal.
export const colorDeForma = {
  1: 'var(--color-arbol)',
  2: 'var(--color-arbusto)',
  3: 'var(--color-herbacea)',
  4: 'var(--color-rastrera)',
}
const formatoMesLargo = new Intl.DateTimeFormat('es-AR', { month: 'long' })

// "2026-11" → "Noviembre 2026" (títulos de la lista de registros).
export function periodoLargo(periodo) {
  const [anio, mes] = periodo.split('-').map(Number)
  const nombre = formatoMesLargo.format(new Date(anio, mes - 1, 1))
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`
}
