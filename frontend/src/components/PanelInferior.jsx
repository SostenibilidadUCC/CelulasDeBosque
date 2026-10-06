import { useId, useRef } from 'react'
import Icono from './Icono.jsx'

// Panel que sube desde abajo (por ejemplo, al tocar una celda del plano en T12).
// Se cierra tocando el fondo, con la X o deslizándolo hacia abajo con el dedo.
export default function PanelInferior({ abierto, titulo, onCerrar, children }) {
  const idTitulo = useId()
  const inicioDedo = useRef(null)

  if (!abierto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-900/45 backdrop-blur-sm" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="max-h-[85svh] w-full overflow-y-auto rounded-t-2xl bg-superficie p-4 pb-8 shadow-nivel-2"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          inicioDedo.current = e.touches[0].clientY
        }}
        onTouchEnd={(e) => {
          // Solo se cierra si el panel está arriba de todo y el dedo bajó más de 80 px.
          const bajo = e.changedTouches[0].clientY - (inicioDedo.current ?? 0)
          if (e.currentTarget.scrollTop === 0 && bajo > 80) onCerrar()
          inicioDedo.current = null
        }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gris-borde" aria-hidden="true" />
        <div className="mb-3 flex items-center justify-between">
          <h2 id={idTitulo} className="text-headline-sm font-semibold text-texto">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            className="flex size-12 items-center justify-center rounded-xl text-texto-2 hover:bg-gris-suave focus-visible:outline-2 focus-visible:outline-bosque-hover"
            aria-label="Cerrar"
          >
            <Icono nombre="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}