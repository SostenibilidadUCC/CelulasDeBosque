import { NavLink } from 'react-router'

// TODO (cuando esté T10 de Magdi): ocultar "Cargar" para el rol lector.
const items = [
  { a: '/', texto: 'Inicio', icono: '🏠' },
  { a: '/celulas', texto: 'Células', icono: '🌳' },
  { a: '/cargar', texto: 'Cargar', icono: '＋', destacado: true },
  { a: '/resultados', texto: 'Resultados', icono: '📊' },
  { a: '/mas', texto: 'Más', icono: '☰' },
]

export default function BarraNavegacion() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-superficie">
      <ul className="mx-auto flex max-w-3xl items-end justify-around">
        {items.map((item) => (
          <li key={item.a} className="flex-1">
            <NavLink
              to={item.a}
              end={item.a === '/'}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${
                  isActive ? 'text-primario' : 'text-texto-suave'
                }`
              }
            >
              <span
                aria-hidden="true"
                className={
                  item.destacado
                    ? '-mt-6 flex size-14 items-center justify-center rounded-full bg-primario text-2xl text-white shadow-flotante'
                    : 'text-xl'
                }
              >
                {item.icono}
              </span>
              {item.texto}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}