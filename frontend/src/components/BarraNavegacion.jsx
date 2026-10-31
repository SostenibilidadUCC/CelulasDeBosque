import { NavLink } from 'react-router'
import { useSesion } from '../sesion/useSesion.js'
import Icono from './Icono.jsx'

// Roles que pueden cargar registros. Es solo para mostrar u ocultar el botón: el permiso real lo valida el backend.
const rolesQueCargan = ['admin', 'cargador']

const items = [
  { a: '/', texto: 'Inicio', icono: 'home' },
  { a: '/celulas', texto: 'Células', icono: 'grid_view' },
  { a: '/cargar', texto: 'Cargar', icono: 'add', destacado: true },
  { a: '/resultados', texto: 'Resultados', icono: 'insights' },
  { a: '/mas', texto: 'Más', icono: 'more_horiz' },
]

export default function BarraNavegacion() {
  const { usuario } = useSesion()
  const puedeCargar = rolesQueCargan.includes(usuario?.rol)
  const itemsVisibles = items.filter((item) => !item.destacado || puedeCargar)

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
              end={item.a === '/'}
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
    </nav>
  )
}
