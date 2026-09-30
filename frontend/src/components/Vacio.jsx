export default function Vacio({ mensaje, children }) {
  return (
    <div className="py-12 text-center text-texto-suave">
      <p className="mb-3 text-4xl" aria-hidden="true">🌱</p>
      <p className="mb-4">{mensaje}</p>
      {children}
    </div>
  )
}