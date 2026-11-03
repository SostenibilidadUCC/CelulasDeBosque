import { Link, useLocation, useNavigate } from 'react-router'
import Icono from './Icono.jsx'

// Pantallas de la barra de abajo: ya se llega con un toque, no necesitan "Volver".
const PANTALLAS_PRINCIPALES = ['/inicio', '/celulas', '/resultados', '/mas']

// A dónde vuelve cada pantalla interna si no hay una pantalla anterior en el historial
// (por ejemplo, si se abrió desde un enlace o se recargó la página).
function pantallaDeArriba(ruta) {
  if (ruta.startsWith('/celulas/') || ruta.startsWith('/isletas/')) return '/celulas'
  if (['/datos', '/usuarios', '/lugares'].includes(ruta)) return '/mas'
  return '/inicio'
}

// Barra superior de las pantallas internas: "Volver" (solo fuera de las pantallas principales)
// y la marca del programa, que lleva al Inicio.
// Es fina y no se mueve al bajar, para que no le quite lugar al contenido en el celular.
export default function BarraSuperior() {
  const { pathname, key } = useLocation()
  const navigate = useNavigate()
  const muestraVolver = !PANTALLAS_PRINCIPALES.includes(pathname)

  function volver() {
    // key 'default' quiere decir que esta es la primera pantalla que se abrió: no hay "atrás".
    if (key !== 'default') navigate(-1)
    else navigate(pantallaDeArriba(pathname))
  }

  return (
    <header className="border-b border-borde bg-superficie">
      <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-2 px-4 sm:px-6 lg:px-10">
        {muestraVolver && (
          <button
            type="button"
            onClick={volver}
            className="-ml-2 flex min-h-12 items-center gap-1 rounded-xl px-2 text-label-lg font-medium text-bosque hover:bg-tonal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque-hover"
          >
            <Icono nombre="arrow_back" />
            Volver
          </button>
        )}
        <Link
          to="/inicio"
          aria-label="Células de Bosque, ir al inicio"
          className={`flex min-h-12 items-center gap-2 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque-hover ${
            muestraVolver ? 'ml-auto' : ''
          }`}
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-bosque text-white">
            <Icono nombre="park" tamano="chico" relleno />
          </span>
          {/* Con "Volver" a la izquierda, en celular queda solo el ícono para que entre todo. */}
          <span className={`flex-col leading-tight ${muestraVolver ? 'hidden sm:flex' : 'flex'}`}>
            <span className="font-titulo text-headline-sm font-semibold text-bosque">Células de Bosque</span>
            <span className="text-body-sm text-texto-2">UCC Sostenible</span>
          </span>
        </Link>
      </div>
    </header>
  )
}
