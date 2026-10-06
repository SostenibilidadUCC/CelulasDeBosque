import Icono from './Icono.jsx'

const variantes = {
  primario: 'bg-bosque text-white hover:bg-bosque-hover active:bg-bosque-hover',
  secundario: 'border-[1.5px] border-niebla bg-superficie text-bosque hover:bg-tonal',
  tonal: 'bg-tonal text-bosque hover:bg-brote',
  texto: 'text-bosque hover:underline',
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
    <button
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando}
      className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-label-lg font-medium transition duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque-hover disabled:cursor-not-allowed disabled:opacity-40 ${variantes[variante]} ${className}`}
      {...resto}
    >
      {cargando ? <Icono nombre="progress_activity" className="animate-spin" /> : icono && <Icono nombre={icono} />}
      {cargando ? textoCargando : children}
    </button>
  )
}