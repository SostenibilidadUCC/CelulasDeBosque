export default function MensajeError({ mensaje, onReintentar }) {
  return (
    <div role="alert" className="rounded-tarjeta border border-error bg-error-fondo p-4 text-error">
      <p className="font-semibold">⚠ {mensaje}</p>
      {onReintentar && (
        <button type="button" onClick={onReintentar} className="mt-2 min-h-12 font-semibold underline">
          Reintentar
        </button>
      )}
    </div>
  )
}