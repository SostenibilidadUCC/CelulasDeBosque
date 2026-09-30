export default function Modal({ abierto, titulo, onCerrar, children }) {
  if (!abierto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="w-full max-w-md rounded-tarjeta bg-superficie p-6 shadow-flotante"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-primario">{titulo}</h2>
        {children}
      </div>
    </div>
  )
}