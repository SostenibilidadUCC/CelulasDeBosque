export default function Tarjeta({ children, className = '', ...resto }) {
  return (
    <div className={`rounded-2xl border border-borde bg-superficie p-4 shadow-nivel-1 ${className}`} {...resto}>
      {children}
    </div>
  )
}