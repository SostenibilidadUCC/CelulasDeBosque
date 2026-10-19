import { useId } from 'react'
import { OBSERVACIONES_MAX } from './validacion.js'

// Observaciones del registro (CAR-13): un solo texto libre, opcional, de hasta 500 caracteres.
// Vive acá y no en components/ porque por ahora es el único campo de varias líneas de la app.
// Mismo estilo que CampoTexto (etiqueta arriba, borde niebla, 16 px), pero con <textarea>.
export default function CampoObservaciones({ valor, onChange }) {
  const id = useId()
  const idContador = `${id}-contador`

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-label-lg font-medium text-texto-2">
        Observaciones (opcional)
      </label>
      <textarea
        id={id}
        value={valor}
        onChange={(evento) => onChange(evento.target.value)}
        maxLength={OBSERVACIONES_MAX}
        rows={4}
        aria-describedby={idContador}
        placeholder="Algo que te haya llamado la atención de la célula"
        className="block min-h-28 w-full resize-y rounded-xl border-[1.5px] border-niebla bg-superficie px-3 py-3 text-body-lg placeholder:text-placeholder focus:border-bosque-hover focus:ring-[3px] focus:ring-hoja/25 focus:outline-none"
      />
      <p id={idContador} className="mt-1 text-right text-body-sm text-texto-3 tabular-nums">
        {valor.length}/{OBSERVACIONES_MAX}
      </p>
    </div>
  )
}
