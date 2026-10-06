import Icono from './Icono.jsx'

// Pregunta de sí o no con la etiqueta a la izquierda: presencia de frutos y nuevas plántulas (CAR-18).
// valor: true (Sí), false (No) o null (sin elegir).
export default function BotonesSiNo({ etiqueta, icono, valor, onChange }) {
  const base =
    'min-h-12 min-w-16 rounded-xl px-4 text-label-lg font-medium transition duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque-hover'
  const apagado = 'border-[1.5px] border-niebla bg-superficie text-texto'

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-label-md font-medium text-texto-2">
        {icono && <Icono nombre={icono} tamano="chico" className="text-bosque-hover" />}
        {etiqueta}
      </span>
      <div className="flex gap-2" role="group" aria-label={etiqueta}>
        <button
          type="button"
          aria-pressed={valor === true}
          onClick={() => onChange(true)}
          className={`${base} ${valor === true ? 'bg-bosque text-white' : apagado}`}
        >
          Sí
        </button>
        <button
          type="button"
          aria-pressed={valor === false}
          onClick={() => onChange(false)}
          className={`${base} ${valor === false ? 'bg-texto-2 text-white' : apagado}`}
        >
          No
        </button>
      </div>
    </div>
  )
}