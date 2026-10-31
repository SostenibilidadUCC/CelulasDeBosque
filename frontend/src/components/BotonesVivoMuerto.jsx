import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { claseOpcion } from './claseOpcion.js'
import Icono from './Icono.jsx'

// Supervivencia de un individuo. Muerto va en gris, nunca en rojo (frontend/CLAUDE.md).
// Por dentro usa el ToggleGroup de shadcn. Tocar de nuevo la opción elegida no la desmarca.
export default function BotonesVivoMuerto({ vivo, onChange }) {
  const valor = vivo === true ? 'vivo' : vivo === false ? 'muerto' : ''

  return (
    <ToggleGroup
      type="single"
      value={valor}
      onValueChange={(nuevo) => {
        if (nuevo) onChange(nuevo === 'vivo')
      }}
      spacing={2}
      aria-label="Supervivencia"
      className="flex w-full"
    >
      <ToggleGroupItem
        value="vivo"
        className={cn(claseOpcion, 'flex-1 data-[state=on]:border-bosque data-[state=on]:bg-bosque data-[state=on]:text-white')}
      >
        <Icono nombre="eco" />
        Vivo
      </ToggleGroupItem>
      <ToggleGroupItem
        value="muerto"
        className={cn(claseOpcion, 'flex-1 data-[state=on]:border-texto-2 data-[state=on]:bg-texto-2 data-[state=on]:text-white')}
      >
        <Icono nombre="remove_circle" />
        Muerto
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
