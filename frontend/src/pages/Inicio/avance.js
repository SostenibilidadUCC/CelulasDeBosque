// Cuentas del avance de carga del mes (sección 7 del documento v4).

// Porcentaje entero de cargadas sobre total. Con total 0 (lugar sin células) da 0, no NaN.
export function porcentaje(cargadas, total) {
  return total > 0 ? Math.round((cargadas / total) * 100) : 0
}

const formatoMes = new Intl.DateTimeFormat('es-AR', { month: 'long' })

// "2026-10" → "octubre 2026" (formato de períodos, frontend/CLAUDE.md).
// La fecha se arma con sus partes para que la zona horaria no la corra.
export function nombreDelPeriodo(periodo) {
  const [anio, mes] = periodo.split('-').map(Number)
  return `${formatoMes.format(new Date(anio, mes - 1, 1))} ${anio}`
}
