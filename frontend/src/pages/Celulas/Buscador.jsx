import { useEffect, useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Icono from '../../components/Icono.jsx'

// Espera después de la última tecla antes de buscar (en milisegundos).
const ESPERA = 400

// EXP-02: buscador por código (A-1-45) o número (45), como en la mayoría de las páginas:
// la lupa adentro del campo, sin botón aparte, y una X para borrar.
// Busca solo cuando la persona deja de escribir un momento ("debounce"): así no se hace un pedido
// por cada letra. La tecla Buscar del teclado del celular busca enseguida.
// "inicial" es la búsqueda que está en la URL.
// Opcionales: etiqueta y placeholder, y soloNumero para abrir el teclado de números
// (lo usa Isleta, donde ya se sabe el lugar y la isleta).
export default function Buscador({
  inicial,
  onBuscar,
  etiqueta = 'Buscar célula',
  placeholder = 'A-1-45 o 45',
  soloNumero = false,
}) {
  const id = useId()
  const [texto, setTexto] = useState(inicial)

  // Si la URL cambia desde afuera (botón Atrás, "Limpiar filtros"), el campo muestra la búsqueda nueva.
  // Es la forma que recomienda React de ajustar un estado cuando cambia una prop, sin useEffect.
  const [inicialPrevio, setInicialPrevio] = useState(inicial)
  if (inicial !== inicialPrevio) {
    setInicialPrevio(inicial)
    setTexto(inicial)
  }

  // Cada tecla reinicia el reloj; si pasan ESPERA ms sin escribir, se busca.
  // El return cancela el reloj anterior.
  useEffect(() => {
    const limpio = texto.trim()
    if (limpio === inicial) return
    const reloj = setTimeout(() => onBuscar(limpio), ESPERA)
    return () => clearTimeout(reloj)
  }, [texto, inicial, onBuscar])

  function alEnviar(evento) {
    evento.preventDefault() // sin esto, el formulario recargaría la página
    if (texto.trim() !== inicial) onBuscar(texto.trim())
  }

  return (
    <form role="search" onSubmit={alEnviar} className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-label-md font-medium text-texto-2">
        {etiqueta}
      </Label>
      <div className="relative">
        <Icono nombre="search" tamano="chico" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-texto-3" />
        {/* type="text" y no "search": algunos navegadores agregan su propia X y quedarían dos. */}
        <Input
          id={id}
          type="text"
          enterKeyHint="search"
          inputMode={soloNumero ? 'numeric' : undefined}
          autoCapitalize={soloNumero ? 'off' : 'characters'}
          autoComplete="off"
          placeholder={placeholder}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="h-12 rounded-xl border-[1.5px] border-niebla bg-superficie pr-12 pl-11 text-body-lg shadow-none placeholder:text-placeholder focus-visible:border-bosque-hover focus-visible:ring-[3px] focus-visible:ring-hoja/25 md:text-body-lg"
        />
        {texto && (
          <button
            type="button"
            aria-label="Borrar búsqueda"
            onClick={() => setTexto('')}
            className="absolute top-0 right-0 flex size-12 items-center justify-center rounded-xl text-texto-3 hover:text-bosque focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-bosque-hover"
          >
            <Icono nombre="close" tamano="chico" />
          </button>
        )}
      </div>
    </form>
  )
}
