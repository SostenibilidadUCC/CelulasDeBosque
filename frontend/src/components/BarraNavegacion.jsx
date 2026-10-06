import { NavLink } from 'react-router'
import Icono from './Icono.jsx'

// TODO (cuando esté T10 de Magda): mostrar "Cargar" solo a Administrador y Cargador.
const items = [
  { a: '/', texto: 'Inicio', icono: 'home' },
  { a: '/celulas', texto: 'Células', icono: 'grid_view' },
  { a: '/cargar', texto: 'Cargar', icono: 'add', destacado: true },
  { a: '/resultados', texto: 'Resultados', icono: 'insights' },
  { a: '/mas', texto: 'Más', icono: 'more_horiz' },
]

export default function BarraNavegacion() {
  return (
    <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-superficie">
      <ul className="mx-auto flex max-w-[1120px] items-end justify-around">
        {items.map((item) => (
          <li key={item.a} className="flex-1">
            <NavLink
              to={item.a}
              end={item.a === '/'}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-1 text-label-sm font-semibold focus-visible:outline-2 focus-visible:outline-bosque-hover ${
                  isActive ? 'text-bosque' : 'text-texto-2'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {item.destacado ? (
                    <span className="-mt-7 flex size-14 items-center justify-center rounded-full bg-bosque text-white shadow-nivel-2">
                      <Icono nombre={item.icono} />
                    </span>
                  ) : (
                    <Icono nombre={item.icono} relleno={isActive} />
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