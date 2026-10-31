import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Icono from './Icono.jsx'

// Por dentro usa el Button de shadcn (components/ui/button.jsx); acá solo se eligen los colores.
const variantes = {
  primario: 'bg-bosque text-white shadow-nivel-1 hover:bg-bosque-hover active:bg-bosque-hover',
  secundario: 'border-[1.5px] border-niebla bg-superficie text-bosque hover:border-bosque-hover hover:bg-tonal',
  tonal: 'bg-tonal text-bosque hover:bg-brote',
  texto: 'text-bosque underline-offset-4 hover:underline',
  peligro: 'border-[1.5px] border-error bg-superficie text-error hover:bg-error-fondo',
}

// Botón de la app. Usá un solo "primario" por pantalla.
// Con cargando={true} muestra un spinner y "Guardando…", y no se puede volver a tocar.
export default function Boton({
  children,
  variante = 'primario',
  icono,
  cargando = false,
  textoCargando = 'Guardando…',
  disabled,
  type = 'button',
  className = '',
  ...resto
}) {
  return (
    <Button
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando}
      className={cn(
        'h-auto min-h-12 w-full rounded-xl px-5 text-label-lg font-semibold whitespace-normal transition duration-150 ease-out',
        'focus-visible:ring-[3px] focus-visible:ring-hoja/40 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variantes[variante],
        className,
      )}
      {...resto}
    >
      {cargando ? <Icono nombre="progress_activity" className="animate-spin" /> : icono && <Icono nombre={icono} />}
      {cargando ? textoCargando : children}
    </Button>
  )
}
