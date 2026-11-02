import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Tarjeta blanca con borde fino y sombra suave. Por dentro usa el Card de shadcn.
export default function Tarjeta({ children, className = '', ...resto }) {
  return (
    <Card className={cn('gap-0 rounded-2xl border-borde bg-superficie p-4 shadow-nivel-1 sm:p-5', className)} {...resto}>
      {children}
    </Card>
  )
}
