import { Skeleton } from '@/components/ui/skeleton'

// Esqueletos grises con la forma del contenido, mientras llegan los datos. Usa el Skeleton de shadcn.
export default function Cargando({ filas = 3 }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <Skeleton key={i} className="h-20 rounded-2xl bg-gris-suave" />
      ))}
    </div>
  )
}
