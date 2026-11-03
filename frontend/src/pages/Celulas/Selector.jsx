import { useId, useRef, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Radix no acepta "" como valor de una opción (lo reserva para "nada elegido"), y los filtros usan ""
// para "Todas las isletas". Por eso adentro se usa esta marca y afuera se sigue viendo "".
const VACIO = '__todas__'

// Tiempo en que un toque sobre el campo, justo después de cerrar la lista, no la vuelve a abrir.
const ESPERA_REAPERTURA = 400

// Desplegable con etiqueta arriba, para los filtros de Células. opciones: [{ valor, texto }].
// Usa el Select de shadcn (components/ui/select.jsx) para que la lista abierta tenga el estilo
// de la app (tarjeta blanca, opciones de 48 px, la elegida con tilde) en lugar del menú del navegador.
export default function Selector({ etiqueta, valor, onChange, opciones }) {
  const id = useId()
  const [abierto, setAbierto] = useState(false)
  const campo = useRef(null)
  const cerradoDesdeElCampo = useRef(0) // momento en que se cerró la lista tocando el campo

  // Con la lista abierta, Radix bloquea los toques en toda la página (también en el campo), así que
  // tocar la flecha no hacía nada. El campo vuelve a recibir toques (pointer-events-auto) y, si la
  // lista está abierta, la cierra. preventDefault hace que Radix no corra su propio manejo del toque.
  // Se anota el momento del cierre para ignorar la reapertura que dispara el mismo toque.
  function cerrarDesdeElCampo(evento) {
    if (!abierto) return
    evento.preventDefault()
    cerradoDesdeElCampo.current = Date.now()
    setAbierto(false)
  }

  // En el celular Radix abre la lista con el "click" que llega después del toque: se frena si
  // ese toque acaba de cerrarla.
  function alHacerClicEnElCampo(evento) {
    if (Date.now() - cerradoDesdeElCampo.current < ESPERA_REAPERTURA) evento.preventDefault()
  }

  function alTocarAfuera(evento) {
    if (campo.current?.contains(evento.target)) cerradoDesdeElCampo.current = Date.now()
  }

  function alCambiarAbierto(abrir) {
    if (abrir && Date.now() - cerradoDesdeElCampo.current < ESPERA_REAPERTURA) return
    setAbierto(abrir)
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-label-md font-medium text-texto-2">
        {etiqueta}
      </label>
      <Select
        open={abierto}
        onOpenChange={alCambiarAbierto}
        value={valor === '' ? VACIO : valor}
        onValueChange={(v) => onChange(v === VACIO ? '' : v)}
      >
        <SelectTrigger
          id={id}
          ref={campo}
          className="pointer-events-auto"
          onPointerDown={cerrarDesdeElCampo}
          onClick={alHacerClicEnElCampo}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent onPointerDownOutside={alTocarAfuera}>
          {opciones.map((o) => (
            <SelectItem key={o.valor} value={o.valor === '' ? VACIO : o.valor}>
              {o.texto}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
