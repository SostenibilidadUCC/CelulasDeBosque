// Skeleton: bloques grises que se muestran mientras llegan los datos.
export default function Cargando({ filas = 3 }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-tarjeta bg-borde" />
      ))}
    </div>
  )
}