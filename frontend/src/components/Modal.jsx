import { useEffect, useId } from 'react'

// Ventana centrada para confirmar algo. Se cierra tocando el fondo o con la tecla Escape.
export default function Modal({ abierto, titulo, onCerrar, children }) {
  const idTitulo = useId()

  useEffect(() => {
    if (!abierto) return
    const alApretarTecla = (e) => {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', alApretarTecla)
    return () => window.removeEventListener('keydown', alApretarTecla)
  }, [abierto, onCerrar])

  if (!abierto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="w-full max-w-[400px] rounded-2xl bg-superficie p-6 shadow-nivel-2"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={idTitulo} className="mb-4 text-headline-sm font-semibold text-texto">
          {titulo}
        </h2>
        {children}
      </div>
    </div>
  )
}