import { cn } from '@/lib/utils'

// Logo de la app: las letras CB con una hoja (el mismo dibujo que el favicon y el ícono de la app).
// Es una imagen PNG y no un SVG con texto: así las letras se ven iguales en todos los navegadores.
// alt vacío porque siempre va al lado del nombre "Células de Bosque": no hace falta leerlo dos veces.
export default function Logo({ className }) {
  return <img src="/icon-192.png" alt="" width={192} height={192} className={cn('size-10 shrink-0', className)} />
}
