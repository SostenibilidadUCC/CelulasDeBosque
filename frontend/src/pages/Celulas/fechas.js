// TODO: copia de fechaCorta de pages/Isleta/Isleta.jsx (Fran, T12). Conviene pasarla a un archivo
// compartido (por ejemplo src/fechas.js) y que las dos pantallas la importen de ahí.

const formatoMes = new Intl.DateTimeFormat('es-AR', { month: 'short' })

// "2026-11-18" → "18 nov 2026" (formato de fechas en tarjetas, frontend/CLAUDE.md).
// La fecha se arma con sus partes para que la zona horaria no la corra un día.
export function fechaCorta(texto) {
  const [anio, mes, dia] = texto.split('-').map(Number)
  const nombreMes = formatoMes.format(new Date(anio, mes - 1, 1)).replace('.', '')
  return `${dia} ${nombreMes} ${anio}`
}
