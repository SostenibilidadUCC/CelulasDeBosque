import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { claseOpcion } from './claseOpcion.js'
import Icono from './Icono.jsx'

// Pregunta de sí o no con la etiqueta a la izquierda: presencia de frutos y nuevas plántulas (CAR-06, CAR-19).
// valor: true (Sí), false (No) o null (sin elegir).
// Por dentro usa el ToggleGroup de shadcn. Tocar de nuevo la opción elegida no la desmarca.
export default function BotonesSiNo({ etiqueta, icono, valor, onChange }) {
  const elegido = valor === true ? 'si' : valor === false ? 'no' : ''

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-label-md font-medium text-texto-2">
        {icono && <Icono nombre={icono} tamano="chico" className="text-bosque-hover" />}
        {etiqueta}
      </span>
      <ToggleGroup
        type="single"
        value={elegido}
        onValueChange={(nuevo) => {
          if (nuevo) onChange(nuevo === 'si')
        }}
        aria-label={etiqueta}
        spacing={2}
        className="flex"
      >
        <ToggleGroupItem
          value="si"
          className={cn(claseOpcion, 'min-w-16 data-[state=on]:border-bosque data-[state=on]:bg-bosque data-[state=on]:text-white')}
        >
          Sí
        </ToggleGroupItem>
        <ToggleGroupItem
          value="no"
          className={cn(claseOpcion, 'min-w-16 data-[state=on]:border-texto-2 data-[state=on]:bg-texto-2 data-[state=on]:text-white')}
        >
          No
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
