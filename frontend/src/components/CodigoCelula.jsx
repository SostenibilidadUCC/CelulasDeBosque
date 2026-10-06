// Código de una célula (A-1-45). Se ve igual en tarjetas, fichas, plano y encabezados.
export default function CodigoCelula({ codigo, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-tonal px-2.5 py-0.5 text-code-tag font-semibold tracking-[0.06em] text-bosque uppercase tabular-nums ${className}`}
    >
      {codigo}
    </span>
  )
}