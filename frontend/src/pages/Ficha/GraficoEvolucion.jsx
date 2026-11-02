import { useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Icono from '../../components/Icono.jsx'
import PuntoGrafico from '../../components/PuntoGrafico.jsx'
import Tarjeta from '../../components/Tarjeta.jsx'
import { colorDeForma, mesCorto } from './formato.js'

// Variables que se pueden elegir en el gráfico (T15: altura o cantidad de flores).
const variables = [
  { campo: 'alturaCm', texto: 'Altura', unidad: 'cm', icono: 'height' },
  { campo: 'flores', texto: 'Cantidad de flores', unidad: 'flores', icono: 'local_florist' },
]

const estiloEjes = { fontSize: 12, fill: 'var(--color-texto-3)' }

// FIC-03: una línea por forma de vida con el valor de cada mes.
// Un individuo muerto no tiene valor ese mes (null), y la línea se corta ahí.
export default function GraficoEvolucion({ individuos, registros }) {
  const [campo, setCampo] = useState('alturaCm')
  const variable = variables.find((v) => v.campo === campo)

  // Recharts quiere una fila por punto del eje X: { mes: 'nov', 1: 45, 2: 30, 3: null, 4: 12 }.
  const datos = registros.map((r) => {
    const fila = { mes: mesCorto(r.periodo) }
    for (const ind of r.individuos) {
      fila[ind.formaDeVida] = ind.vivo ? ind[campo] : null
    }
    return fila
  })

  return (
    <Tarjeta className="flex flex-col gap-3">
      <div className="flex w-fit flex-wrap rounded-full bg-segmento p-1" role="group" aria-label="Variable del gráfico">
        {variables.map((v) => (
          <button
            key={v.campo}
            type="button"
            aria-pressed={campo === v.campo}
            onClick={() => setCampo(v.campo)}
            className={`flex min-h-10 items-center gap-1 rounded-full px-4 text-label-md transition duration-150 ease-out focus-visible:outline-2 focus-visible:outline-bosque-hover ${
              campo === v.campo ? 'bg-superficie font-semibold text-bosque shadow-nivel-1' : 'text-texto-2'
            }`}
          >
            <Icono nombre={v.icono} tamano="chico" />
            {v.texto}
          </button>
        ))}
      </div>

      {registros.length < 2 ? (
        <p className="py-8 text-center text-body-md text-texto-2">Todavía no hay registros suficientes para este gráfico</p>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke="var(--color-borde)" />
              <XAxis dataKey="mes" tick={estiloEjes} tickLine={false} axisLine={false} />
              <YAxis tick={estiloEjes} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, 'auto']} />
              <Tooltip
                formatter={(valor) => `${valor} ${variable.unidad}`}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid var(--color-borde)',
                  boxShadow: 'var(--shadow-nivel-2)',
                  fontSize: 14,
                }}
              />
              {/* itemSorter={null}: la leyenda sigue el orden de las líneas (Árbol primero), no el alfabético */}
              <Legend verticalAlign="top" iconType="plainline" itemSorter={null} wrapperStyle={{ fontSize: 14, paddingBottom: 8 }} />
              {individuos.map((ind) => (
                <Line
                  key={ind.formaDeVida}
                  type="monotone"
                  dataKey={ind.formaDeVida}
                  name={ind.nombre}
                  stroke={colorDeForma[ind.formaDeVida]}
                  strokeWidth={2}
                  dot={<PuntoGrafico formaDeVida={ind.formaDeVida} />}
                  activeDot={<PuntoGrafico formaDeVida={ind.formaDeVida} />}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Tarjeta>
  )
}