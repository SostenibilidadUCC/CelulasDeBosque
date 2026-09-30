export default function Tarjeta({ children, className = '', ...resto }) {
  return (
    <div className={`rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta ${className}`} {...resto}>
      {children}
    </div>
  )
}