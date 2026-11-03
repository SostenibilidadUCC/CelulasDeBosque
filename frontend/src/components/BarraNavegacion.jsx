import { useState } from 'react'
import { NavLink } from 'react-router'
import PanelElegirCelula from '../pages/Carga/PanelElegirCelula.jsx'
import { useSesion } from '../sesion/useSesion.js'
import Icono from './Icono.jsx'

// El botón Cargar es solo para el cargador, que tiene un lugar: abre el panel "Elegí la célula"
// con las células de su lugar (las que faltan, en ámbar; las cargadas se pueden editar). El admin no tiene lugar, así que carga desde la tarjeta de cada célula.
// Es solo para mostrar u ocultar el botón: el permiso real lo valida el backend.
const items = [
  { a: '/inicio', texto: 'Inicio', icono: 'home' },
  { a: '/celulas', texto: 'Células', icono: 'grid_view' },
  { a: '/cargar', texto: 'Cargar', icono: 'add', destacado: true },
  { a: '/resultados', texto: 'Resultados', icono: 'insights' },
  { a: '/mas', texto: 'Cuenta', icono: 'account_circle' },
]

export default function BarraNavegacion() {
  const { usuario } = useSesion()
  const [elegirAbierto, setElegirAbierto] = useState(false)
  const lugarId = usuario?.rol === 'cargador' ? usuario.lugar?.id : null
  const itemsVisibles = items.filter((item) => !item.destacado || lugarId != null)

  function abrirElegir(e) {
    e.preventDefault() // no navega a /cargar: abre el panel
    setElegirAbierto(true)
  }

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-[1120px] items-end justify-around px-1">
        {itemsVisibles.map((item) => (
          <li key={item.a} className="flex-1">
            <NavLink
              to={item.a}
              end={item.a === '/inicio'}
              onClick={item.destacado ? abrirElegir : undefined}
              aria-haspopup={item.destacado ? 'dialog' : undefined}
              className={({ isActive }) =>
                `flex min-h-[72px] flex-col items-center justify-center gap-1 text-label-sm font-semibold focus-visible:outline-2 focus-visible:outline-bosque-hover ${
                  isActive ? 'text-bosque' : 'text-texto-2'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {item.destacado ? (
                    <span className="-mt-8 flex size-14 items-center justify-center rounded-full bg-bosque text-white shadow-nivel-2 ring-4 ring-superficie">
                      <Icono nombre={item.icono} />
                    </span>
                  ) : (
                    // El ítem activo lleva una pastilla verde suave detrás del ícono, además del color.
                    <span
                      className={`flex h-8 w-14 items-center justify-center rounded-full transition duration-150 ease-out ${
                        isActive ? 'bg-brote' : ''
                      }`}
                    >
                      <Icono nombre={item.icono} relleno={isActive} />
                    </span>
                  )}
                  {item.texto}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
      {lugarId != null && (
        <PanelElegirCelula abierto={elegirAbierto} onCerrar={() => setElegirAbierto(false)} lugarId={lugarId} />
      )}
    </nav>
  )
}
