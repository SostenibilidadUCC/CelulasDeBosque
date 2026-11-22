import { useId } from 'react'
import { cn } from '@/lib/utils'
import { claseOpcion } from '../../components/claseOpcion.js'
import Icono from '../../components/Icono.jsx'

// Dos botones grandes lado a lado para elegir una opción (tipo de lugar, habilitado o no).
// Usa la misma clase que BotonesSiNo. opciones = [{ valor, texto, icono }].
export default function DosOpciones({ etiqueta, opciones, valor, onCambiar }) {
  const idEtiqueta = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <span id={idEtiqueta} className="text-label-md font-medium text-texto-2">
        {etiqueta}
      </span>
      <div role="radiogroup" aria-labelledby={idEtiqueta} className="grid grid-cols-2 gap-2">
        {opciones.map((opcion) => {
          const elegida = opcion.valor === valor
          return (
            <button
              key={opcion.valor}
              type="button"
              role="radio"
              aria-checked={elegida}
              onClick={() => onCambiar(opcion.valor)}
              // cn (y no un template string) porque claseOpcion ya trae bg-superficie, border-niebla
              // y text-texto: si se suman bg-bosque y text-white sin sacar las otras, Tailwind no
              // usa "la última", y la opción elegida quedaba con texto blanco sobre fondo blanco.
              className={cn(
                claseOpcion,
                'flex items-center justify-center gap-2',
                elegida && 'border-bosque bg-bosque text-white hover:bg-bosque-hover hover:text-white',
              )}
            >
              {opcion.icono && <Icono nombre={opcion.icono} tamano="chico" />}
              {opcion.texto}
            </button>
          )
        })}
      </div>
    </div>
  )
}
