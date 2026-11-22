// Formato de las celdas de la tabla de datos (T21). Las reglas son las de frontend/CLAUDE.md, Redacción.
// El período usa periodoLargo de la Ficha ("Noviembre 2026") y la fecha, fechaEnTexto de Carga ("18/11/2026").

const formatoNumero = new Intl.NumberFormat('es-AR')

// Lo que se muestra en una celda sin dato (por ejemplo, la altura de un individuo muerto).
export const SIN_DATO = '—'

// true → "Sí", false → "No", null → "—".
export function siNo(valor) {
  if (valor == null) return SIN_DATO
  return valor ? 'Sí' : 'No'
}

// 1420.5 → "1.420,5". null → "—".
export function numero(valor) {
  return valor == null ? SIN_DATO : formatoNumero.format(valor)
}
