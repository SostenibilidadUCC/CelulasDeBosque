import { useEffect, useId, useRef, useState } from 'react'
import Icono from '../../components/Icono.jsx'
import PanelInferior from '../../components/PanelInferior.jsx'
import { scrollParaCentrar, valorACentrar, valoresDelRango } from './individuos.js'

// Alto de cada fila de la lista, en px. Tiene que coincidir con la clase h-12 de las filas:
// con eso se calcula dónde está cada fila sin tener que medirla.
const ALTO_FILA = 48

// Selector de un número (altura o flores) que reemplaza al <select> nativo (T14).
// Con el <select>, el celular abre la lista dejando el valor elegido abajo de todo, y no se puede
// cambiar. Este abre un PanelInferior con la lista y deja el valor actual en el medio.
//
// Props:
// - etiqueta e icono: lo que se ve a la izquierda del botón (y el título del panel).
// - valor: el número elegido, o null (se ve "Elegí").
// - min y max: el rango (altura 1 a 999, flores 0 a 100).
// - unidad (opcional): por ejemplo "cm" → "173 cm".
// - referencia (opcional): si no hay valor, la lista se centra en este (la altura del mes anterior).
// - onCambiar(valor): se llama con el número elegido.
// - error (opcional): texto del error, debajo del botón y enlazado con aria-describedby.
//
// PENDIENTE (otro ticket): PanelInferior (components/) no maneja el foco ni la tecla Esc, ni
// atrapa Tab. Acá se hace lo mínimo por nuestra cuenta: al abrir, el foco va a la lista; Esc
// cierra si el foco está en la lista; al cerrar, el foco vuelve al botón. Tab todavía puede
// salir del panel, y Esc no funciona con el foco en la X del panel.
export default function SelectorCentrado({ etiqueta, icono, valor, min, max, unidad, referencia, onCambiar, error }) {
  const id = useId()
  const idLista = `${id}-lista`
  const idError = `${id}-error`
  const idFila = (v) => `${id}-fila-${v}`

  const [abierto, setAbierto] = useState(false)
  // La fila "activa" para el teclado (las flechas la mueven y Enter la elige). Se marca con
  // aria-activedescendant: el foco queda en la lista y el lector de pantalla lee la fila activa.
  const [activo, setActivo] = useState(null)
  const boton = useRef(null)
  const lista = useRef(null)
  const aCentrar = useRef(min) // el valor que se deja en el medio al abrir
  const valores = valoresDelRango(min, max)
  const texto = (v) => (unidad ? `${v} ${unidad}` : String(v))

  function abrir() {
    aCentrar.current = valorACentrar(valor, referencia, min)
    setActivo(aCentrar.current)
    setAbierto(true)
  }

  function cerrar() {
    setAbierto(false)
    boton.current?.focus()
  }

  function elegir(v) {
    onCambiar(v)
    cerrar()
  }

  // Al abrir: primero el foco en la lista (preventScroll: que el navegador no mueva nada) y después
  // se centra el valor calculando el scrollTop. No se usa scrollIntoView porque también movería la
  // página de atrás. La cuenta es exacta aunque las filas no estén dibujadas: todas reservan 48 px.
  // La fila del valor v es la número v − min (la lista arranca en min).
  useEffect(() => {
    if (!abierto || !lista.current) return
    lista.current.focus({ preventScroll: true })
    const indice = Math.max(aCentrar.current - min, 0)
    lista.current.scrollTop = scrollParaCentrar(indice, ALTO_FILA, lista.current.clientHeight)
  }, [abierto, min])

  // Mueve la fila activa y, si quedó fuera de la vista, scrollea lo justo para mostrarla.
  function moverA(indice) {
    const nuevo = valores[Math.min(Math.max(indice, 0), valores.length - 1)]
    setActivo(nuevo)
    const caja = lista.current
    if (!caja) return
    const arriba = valores.indexOf(nuevo) * ALTO_FILA
    if (arriba < caja.scrollTop) caja.scrollTop = arriba
    else if (arriba + ALTO_FILA > caja.scrollTop + caja.clientHeight) caja.scrollTop = arriba + ALTO_FILA - caja.clientHeight
  }

  function alApretarTecla(evento) {
    const indice = valores.indexOf(activo)
    const acciones = {
      ArrowDown: () => moverA(indice + 1),
      ArrowUp: () => moverA(indice - 1),
      Home: () => moverA(0),
      End: () => moverA(valores.length - 1),
      Enter: () => activo != null && elegir(activo),
      ' ': () => activo != null && elegir(activo),
      Escape: () => cerrar(),
    }
    if (acciones[evento.key]) {
      evento.preventDefault() // que las flechas no scrolleen la lista por su cuenta
      acciones[evento.key]()
    }
  }

  // PanelInferior se cierra cuando el dedo baja más de 80 px y su propio scroll está arriba de todo.
  // Lo detecta con onTouchStart/onTouchEnd de React (no con escuchas nativas), así que frenar el
  // evento acá con stopPropagation alcanza: scrollear la lista hacia arriba no cierra el panel.
  // El panel se sigue cerrando deslizando desde el título o la manija.
  const frenarToque = (evento) => evento.stopPropagation()

  return (
    <div>
      <button
        ref={boton}
        type="button"
        onClick={abrir}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-describedby={error ? idError : undefined}
        // Lo busca el focus() del primer error en FormularioCarga (Carga.jsx).
        data-campo-error={error ? 'true' : undefined}
        className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border-[1.5px] bg-superficie px-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque-hover ${
          error ? 'border-error' : 'border-niebla'
        }`}
      >
        <span className="flex items-center gap-2 text-label-md font-medium text-texto-2">
          {icono && <Icono nombre={icono} tamano="chico" className="text-bosque-hover" />}
          {etiqueta}
        </span>
        <span className="flex items-center gap-1 text-body-lg font-semibold text-texto tabular-nums">
          {valor == null ? <span className="font-normal text-texto-2">Elegí</span> : texto(valor)}
          <Icono nombre="unfold_more" tamano="chico" className="text-texto-2" />
        </span>
      </button>

      {error && (
        <p id={idError} role="alert" className="mt-1 flex items-center gap-1 text-body-sm text-error">
          <Icono nombre="error" tamano="chip" />
          {error}
        </p>
      )}

      <PanelInferior abierto={abierto} titulo={etiqueta} onCerrar={cerrar}>
        <ul
          ref={lista}
          id={idLista}
          role="listbox"
          tabIndex={0}
          aria-label={etiqueta}
          aria-activedescendant={activo != null ? idFila(activo) : undefined}
          onKeyDown={alApretarTecla}
          onTouchStart={frenarToque}
          onTouchMove={frenarToque}
          onTouchEnd={frenarToque}
          // overscroll-contain: al llegar al final, el scroll no se pasa a la página de atrás.
          // touch-pan-y: el dedo solo scrollea en vertical.
          className="max-h-[60svh] overflow-y-auto overscroll-contain rounded-xl border border-borde touch-pan-y focus-visible:outline-2 focus-visible:outline-bosque-hover"
        >
          {valores.map((v) => {
            const elegido = v === valor
            return (
              <li
                key={v}
                id={idFila(v)}
                role="option"
                aria-selected={elegido}
                onClick={() => elegir(v)}
                // content-visibility: el navegador no dibuja las filas que no se ven (son hasta 999),
                // pero cada una reserva sus 48 px, así el scroll y la cuenta para centrar son exactos.
                className={`flex h-12 cursor-pointer items-center justify-between px-4 text-body-lg tabular-nums [content-visibility:auto] [contain-intrinsic-size:auto_48px] ${
                  elegido ? 'bg-bosque font-semibold text-white' : 'text-texto hover:bg-tonal'
                } ${v === activo ? 'outline-2 -outline-offset-2 outline-bosque-hover' : ''}`}
              >
                {texto(v)}
                {/* El elegido se distingue también con el ícono y el texto, no solo con el color. */}
                {elegido && (
                  <span className="flex items-center gap-1 text-label-md">
                    <Icono nombre="check" tamano="chico" />
                    Elegido
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </PanelInferior>
    </div>
  )
}
