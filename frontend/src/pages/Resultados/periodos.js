// Opciones del filtro de período (RES-01) y cómo se convierten en desde/hasta para /api/metricas.
// meses: cuántos meses entran contando el actual; null = desde la plantación (sin "desde").
export const opcionesPeriodo = [
  { valor: 'actual', texto: 'Mes actual', meses: 1 },
  { valor: '3', texto: 'Últimos 3 meses', meses: 3 },
  { valor: '6', texto: 'Últimos 6 meses', meses: 6 },
  { valor: '12', texto: 'Últimos 12 meses', meses: 12 },
  { valor: 'todo', texto: 'Desde la plantación', meses: null },
]

// "2026-10" menos 2 meses → "2026-08". Se cuenta en meses totales (año × 12 + mes)
// para que el cambio de año salga solo: "2026-01" menos 1 → "2025-12".
export function restarMeses(periodo, cantidad) {
  const [anio, mes] = periodo.split('-').map(Number)
  const total = anio * 12 + (mes - 1) - cantidad
  const nuevoAnio = Math.floor(total / 12)
  const nuevoMes = (total % 12) + 1
  return `${nuevoAnio}-${String(nuevoMes).padStart(2, '0')}`
}

// periodoActual viene del backend (GET /api/lugares), en hora de Córdoba: así no depende del
// reloj del celular. Devuelve { desde, hasta }; desde es undefined si es "desde la plantación".
export function rangoDelPeriodo(valor, periodoActual) {
  const opcion = opcionesPeriodo.find((o) => o.valor === valor)
  if (!opcion?.meses) return { desde: undefined, hasta: periodoActual }
  return { desde: restarMeses(periodoActual, opcion.meses - 1), hasta: periodoActual }
}
