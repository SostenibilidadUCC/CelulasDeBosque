import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import Icono from './Icono.jsx'

// Supervivencia de un individuo. Muerto va en gris, nunca en rojo (frontend/CLAUDE.md).
// Control segmentado chico (el mismo estilo que el filtro de estado de Células): va al lado del
// nombre de la forma de vida para no competir con los datos de la planta. Con el relleno de 4 px,
// el control entero mide 48 px de alto.
// Por dentro usa el ToggleGroup de shadcn. Tocar de nuevo la opción elegida no la desmarca.
const claseItem =
  'h-10 gap-1 rounded-full border-0 bg-transparent px-3 text-label-md font-medium text-texto-2 shadow-none transition duration-150 ease-out hover:bg-transparent hover:text-bosque focus-visible:ring-[3px] focus-visible:ring-hoja/40 data-[state=on]:bg-superficie data-[state=on]:font-semibold data-[state=on]:shadow-nivel-1'

export default function BotonesVivoMuerto({ vivo, onChange }) {
  const valor = vivo === true ? 'vivo' : vivo === false ? 'muerto' : ''

  return (
    <ToggleGroup
      type="single"
      value={valor}
      onValueChange={(nuevo) => {
        if (nuevo) onChange(nuevo === 'vivo')
      }}
      spacing={1}
      aria-label="Supervivencia"
      className="shrink-0 rounded-full bg-segmento p-1"
    >
      <ToggleGroupItem value="vivo" className={`${claseItem} data-[state=on]:text-bosque`}>
        <Icono nombre="eco" tamano="chip" />
        Vivo
      </ToggleGroupItem>
      <ToggleGroupItem value="muerto" className={`${claseItem} data-[state=on]:text-texto-2`}>
        <Icono nombre="remove_circle" tamano="chip" />
        Muerto
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
