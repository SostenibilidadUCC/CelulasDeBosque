// Esqueletos grises con la forma del contenido, mientras llegan los datos.
export default function Cargando({ filas = 3 }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl bg-gris-suave" />
      ))}
    </div>
  )
}