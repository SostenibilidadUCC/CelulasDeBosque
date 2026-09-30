// Panel que sube desde abajo. Se usa, por ejemplo, al tocar una celda del plano (T12).
export default function PanelInferior({ abierto, titulo, onCerrar, children }) {
  if (!abierto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-900/45 backdrop-blur-sm" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="max-h-[85svh] w-full overflow-y-auto rounded-t-3xl bg-superficie p-4 pb-8 shadow-flotante"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-borde" aria-hidden="true" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primario">{titulo}</h2>
          <button type="button" onClick={onCerrar} className="size-12 text-xl text-texto-suave" aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}