// Punto de un gráfico de líneas de Recharts con una forma distinta para cada forma de vida
// (círculo, cuadrado, triángulo y rombo): así las líneas se distinguen aunque no se vea el color
// (frontend/CLAUDE.md, Gráficos). Lo usan la Ficha (T15) y Resultados (T18).
// Uso: <Line dot={<PuntoGrafico formaDeVida={1} />} />. Recharts le agrega cx, cy y stroke.
export default function PuntoGrafico({ cx, cy, stroke, formaDeVida }) {
  if (cx == null || cy == null) return null
  const r = 4
  if (formaDeVida === 2) return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill={stroke} />
  if (formaDeVida === 3) return <polygon points={`${cx},${cy - r - 1} ${cx + r + 1},${cy + r} ${cx - r - 1},${cy + r}`} fill={stroke} />
  if (formaDeVida === 4) return <polygon points={`${cx},${cy - r - 1} ${cx + r + 1},${cy} ${cx},${cy + r + 1} ${cx - r - 1},${cy}`} fill={stroke} />
  return <circle cx={cx} cy={cy} r={r} fill={stroke} />
}
