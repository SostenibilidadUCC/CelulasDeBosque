import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { mesCorto } from '../Ficha/formato.js'

const estiloEjes = { fontSize: 12, fill: 'var(--color-texto-3)' }
const estiloTooltip = { borderRadius: 12, border: '1px solid var(--color-borde)', boxShadow: 'var(--shadow-nivel-2)', fontSize: 14 }

// RES-05: tasa de supervivencia de cada mes. Es una sola serie, así que va en color bosque
// y de 0 a 100 (frontend/CLAUDE.md, Gráficos).
export default function GraficoSupervivencia({ evolucion }) {
  const datos = evolucion.map((m) => ({ mes: mesCorto(m.periodo), supervivencia: m.supervivencia }))

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--color-borde)" />
          <XAxis dataKey="mes" tick={estiloEjes} tickLine={false} axisLine={false} />
          <YAxis tick={estiloEjes} tickLine={false} axisLine={false} domain={[0, 100]} unit=" %" />
          <Tooltip
            formatter={(valor) => [`${valor.toLocaleString('es-AR')} %`, 'Supervivencia']}
            contentStyle={estiloTooltip}
          />
          <Line
            type="monotone"
            dataKey="supervivencia"
            stroke="var(--color-bosque)"
            strokeWidth={2}
            dot={{ r: 4, fill: 'var(--color-bosque)' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
