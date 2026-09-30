// Muerto en gris, no en rojo: el DESIGN.md pide evitar alertas alarmistas.
export default function BotonesVivoMuerto({ vivo, onChange }) {
  const base = 'min-h-12 flex-1 rounded-control border-2 text-base font-semibold transition'
  return (
    <div className="flex gap-2" role="group" aria-label="Supervivencia">
      <button
        type="button"
        aria-pressed={vivo === true}
        onClick={() => onChange(true)}
        className={`${base} ${vivo === true ? 'border-primario bg-primario text-white' : 'border-vivo-borde bg-superficie text-vivo-texto'}`}
      >
        🌿 Vivo
      </button>
      <button
        type="button"
        aria-pressed={vivo === false}
        onClick={() => onChange(false)}
        className={`${base} ${vivo === false ? 'border-muerto-icono bg-muerto-icono text-white' : 'border-muerto-borde bg-superficie text-muerto-texto'}`}
      >
        – Muerto
      </button>
    </div>
  )
}