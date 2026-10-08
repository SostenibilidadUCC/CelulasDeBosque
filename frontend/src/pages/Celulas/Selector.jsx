import { useId } from 'react'

// Desplegable nativo con etiqueta arriba, para los filtros de Células. En el celular abre el
// selector propio del teléfono. opciones: [{ valor, texto }].
export default function Selector({ etiqueta, valor, onChange, opciones }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-label-md font-medium text-texto-2">
        {etiqueta}
      </label>
      <select
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-xl border-[1.5px] border-niebla bg-superficie px-3 text-body-lg focus:border-bosque-hover focus:ring-[3px] focus:ring-hoja/25 focus:outline-none"
      >
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </div>
  )
}
