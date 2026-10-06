import Icono from './Icono.jsx'

// Supervivencia de un individuo. Muerto va en gris, nunca en rojo (frontend/CLAUDE.md).
export default function BotonesVivoMuerto({ vivo, onChange }) {
  const base =
    'inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl text-label-lg font-medium transition duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque-hover'
  const apagado = 'border-[1.5px] border-niebla bg-superficie text-texto'

  return (
    <div className="flex gap-2" role="group" aria-label="Supervivencia">
      <button
        type="button"
        aria-pressed={vivo === true}
        onClick={() => onChange(true)}
        className={`${base} ${vivo === true ? 'bg-bosque text-white' : apagado}`}
      >
        <Icono nombre="eco" />
        Vivo
      </button>
      <button
        type="button"
        aria-pressed={vivo === false}
        onClick={() => onChange(false)}
        className={`${base} ${vivo === false ? 'bg-texto-2 text-white' : apagado}`}
      >
        <Icono nombre="remove_circle" />
        Muerto
      </button>
    </div>
  )
}