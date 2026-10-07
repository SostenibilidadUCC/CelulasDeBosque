import { useId } from 'react'
import Icono from './Icono.jsx'

// Campo de texto con etiqueta visible arriba y mensaje de error abajo.
// Recibe cualquier prop de <input> (type, value, onChange, autoComplete…) por "resto".
// Si no le pasás "id", genera uno solo para unir la etiqueta con el campo.
export default function CampoTexto({ etiqueta, id, error, className = '', ...resto }) {
  const idGenerado = useId()
  const idCampo = id ?? idGenerado
  const idError = `${idCampo}-error`

  return (
    <div>
      <label htmlFor={idCampo} className="mb-1 block text-label-md font-medium text-texto-2">
        {etiqueta}
      </label>
      <input
        id={idCampo}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? idError : undefined}
        className={`h-12 w-full rounded-xl border-[1.5px] bg-superficie px-3 text-body-lg placeholder:text-placeholder focus:ring-[3px] focus:ring-hoja/25 focus:outline-none ${
          error ? 'border-error focus:border-error' : 'border-niebla focus:border-bosque-hover'
        } ${className}`}
        {...resto}
      />
      {error && (
        <p id={idError} className="mt-1 flex items-center gap-1 text-body-sm text-error">
          <Icono nombre="error" tamano="chip" />
          {error}
        </p>
      )}
    </div>
  )
}
