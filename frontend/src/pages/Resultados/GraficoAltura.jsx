import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import PuntoGrafico from '../../components/PuntoGrafico.jsx'
import { colorDeForma, mesCorto } from '../Ficha/formato.js'

const estiloEjes = { fontSize: 12, fill: 'var(--color-texto-3)' }
const estiloTooltip = { borderRadius: 12, border: '1px solid var(--color-borde)', boxShadow: 'var(--shadow-nivel-2)', fontSize: 14 }

// RES-04: altura promedio de los individuos vivos por mes, una línea por forma de vida.
// evolucion: [{ periodo, alturaPromedio: { "1": 85.5, ... } }]. formas: las que se dibujan.
export default function GraficoAltura({ evolucion, formas }) {
  // Recharts quiere una fila por mes: { mes: 'oct', 1: 85.5, 2: 60.1, ... }.
  const datos = evolucion.map((m) => ({ mes: mesCorto(m.periodo), ...m.alturaPromedio }))

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--color-borde)" />
          <XAxis dataKey="mes" tick={estiloEjes} tickLine={false} axisLine={false} />
          <YAxis tick={estiloEjes} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, 'auto']} />
          <Tooltip formatter={(valor) => `${valor.toLocaleString('es-AR')} cm`} contentStyle={estiloTooltip} />
          {/* itemSorter={null}: la leyenda sigue el orden de las líneas (Árbol primero), no el alfabético */}
          <Legend verticalAlign="top" iconType="plainline" itemSorter={null} wrapperStyle={{ fontSize: 14, paddingBottom: 8 }} />
          {formas.map((forma) => (
            <Line
              key={forma.formaDeVida}
              type="monotone"
              dataKey={forma.formaDeVida}
              name={forma.nombre}
              stroke={colorDeForma[forma.formaDeVida]}
              strokeWidth={2}
              dot={<PuntoGrafico formaDeVida={forma.formaDeVida} />}
              activeDot={<PuntoGrafico formaDeVida={forma.formaDeVida} />}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
