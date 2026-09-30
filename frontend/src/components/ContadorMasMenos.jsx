import { useId } from 'react'

// Campo numérico con botones −1 / +1. Se usa para la altura y los polinizadores.
export default function ContadorMasMenos({ valor, onChange, etiqueta, unidad, min = 0, max = 999 }) {
  const id = useId()

  const cambiar = (nuevo) => {
    if (Number.isNaN(nuevo)) return
    onChange(Math.min(max, Math.max(min, nuevo)))
  }

  const boton =
    'size-12 shrink-0 rounded-control border-[1.5px] border-borde-verde bg-superficie text-lg font-bold text-primario'

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-texto-suave">
        {etiqueta}
      </label>
      <div className="flex items-center gap-2">
        <button type="button" className={boton} onClick={() => cambiar((valor ?? 0) - 1)} aria-label={`Restar 1 a ${etiqueta}`}>
          −1
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          value={valor ?? ''}
          onChange={(e) => cambiar(e.target.value === '' ? min : Number(e.target.value))}
          className="numeros h-12 w-24 rounded-control border-[1.5px] border-borde-verde bg-superficie text-center text-xl focus:border-primario-hover focus:outline-none focus:ring-[3px] focus:ring-secundario/25"
        />
        {unidad && <span className="text-texto-suave">{unidad}</span>}
        <button type="button" className={boton} onClick={() => cambiar((valor ?? 0) + 1)} aria-label={`Sumar 1 a ${etiqueta}`}>
          +1
        </button>
      </div>
    </div>
  )
}