import { useId } from 'react'
import Icono from './Icono.jsx'

// 0 a 100 es la propuesta del documento v4 (pregunta 15, a confirmar con la clienta).
const DE_0_A_100 = Array.from({ length: 101 }, (_, i) => i)

// Desplegable nativo: en el celular abre el selector propio del teléfono (CAR-18).
// "opciones" puede ser una lista de números ([0, 1, 2…]) o de objetos ({ valor, texto })
// por si la clienta pide rangos como "1 a 5". Así no hay que reescribir el componente.
export default function SelectorNumero({ etiqueta, icono = 'filter_vintage', valor, onChange, opciones = DE_0_A_100, ayuda }) {
  const id = useId()
  const lista = opciones.map((o) => (typeof o === 'object' ? o : { valor: o, texto: String(o) }))

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="flex items-center gap-2 text-label-md font-medium text-texto-2">
          <Icono nombre={icono} tamano="chico" className="text-bosque-hover" />
          {etiqueta}
        </label>
        <select
          id={id}
          value={valor ?? ''}
          onChange={(e) => onChange(lista.find((o) => String(o.valor) === e.target.value).valor)}
          className="h-12 w-28 rounded-xl border-[1.5px] border-niebla bg-superficie px-3 text-body-lg tabular-nums focus:border-bosque-hover focus:ring-[3px] focus:ring-hoja/25 focus:outline-none"
        >
          {lista.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.texto}
            </option>
          ))}
        </select>
      </div>
      {ayuda && <p className="mt-1 text-right text-body-sm text-texto-3">{ayuda}</p>}
    </div>
  )
}