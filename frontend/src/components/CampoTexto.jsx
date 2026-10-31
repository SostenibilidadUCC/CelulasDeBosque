import { useId } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import Icono from './Icono.jsx'

// Campo de texto con etiqueta visible arriba y mensaje de error abajo.
// Recibe cualquier prop de <input> (type, value, onChange, autoComplete…) por "resto".
// Si no le pasás "id", genera uno solo para unir la etiqueta con el campo.
// Por dentro usa Input y Label de shadcn.
export default function CampoTexto({ etiqueta, id, error, className = '', ...resto }) {
  const idGenerado = useId()
  const idCampo = id ?? idGenerado
  const idError = `${idCampo}-error`

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={idCampo} className="text-label-md font-medium text-texto-2">
        {etiqueta}
      </Label>
      <Input
        id={idCampo}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? idError : undefined}
        className={cn(
          'h-12 rounded-xl border-[1.5px] bg-superficie px-3.5 text-body-lg shadow-none placeholder:text-placeholder md:text-body-lg',
          'focus-visible:ring-[3px] focus-visible:ring-hoja/25',
          error ? 'border-error focus-visible:border-error' : 'border-niebla focus-visible:border-bosque-hover',
          className,
        )}
        {...resto}
      />
      {error && (
        <p id={idError} className="flex items-center gap-1 text-body-sm text-error">
          <Icono nombre="error" tamano="chip" />
          {error}
        </p>
      )}
    </div>
  )
}
