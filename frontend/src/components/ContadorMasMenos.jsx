import { useId } from 'react'

// Número con botones −1 / +1 que también se puede tipear. Se usa para la altura y los polinizadores.
// "ayuda" es la línea de abajo, por ejemplo "Octubre: 173 cm · +12" (CAR-07).
export default function ContadorMasMenos({ valor, onChange, etiqueta, unidad, ayuda, min = 0, max = 999 }) {
  const id = useId()

  const cambiar = (nuevo) => {
    if (Number.isNaN(nuevo)) return
    onChange(Math.min(max, Math.max(min, nuevo)))
  }

  const boton =
    'flex size-12 shrink-0 items-center justify-center rounded-xl bg-tonal text-label-lg font-semibold text-bosque transition duration-150 ease-out hover:bg-brote focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque-hover'

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-label-md font-medium text-texto-2">
        {etiqueta}
      </label>
      <div className="flex items-center gap-3">
        <button type="button" className={boton} onClick={() => cambiar((valor ?? 0) - 1)} aria-label={`Restar 1 a ${etiqueta}`}>
          −1
        </button>
        <div className="flex items-baseline gap-1">
          <input
            id={id}
            type="number"
            inputMode="numeric"
            value={valor ?? ''}
            onChange={(e) => cambiar(e.target.value === '' ? min : Number(e.target.value))}
            className="h-12 w-20 [appearance:textfield] rounded-xl border-[1.5px] border-niebla bg-superficie text-center text-headline-md font-semibold tabular-nums focus:border-bosque-hover focus:ring-[3px] focus:ring-hoja/25 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          {unidad && <span className="text-body-md text-texto-2">{unidad}</span>}
        </div>
        <button type="button" className={boton} onClick={() => cambiar((valor ?? 0) + 1)} aria-label={`Sumar 1 a ${etiqueta}`}>
          +1
        </button>
      </div>
      {ayuda && <p className="mt-1 text-body-sm text-texto-3 tabular-nums">{ayuda}</p>}
    </div>
  )
}