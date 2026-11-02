import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { obtenerCelulasDeLugar } from '../api.js'
import { buscarProximaCelula } from '../pages/Carga/proximaCelula.js'
import { useSesion } from '../sesion/useSesion.js'
import Icono from './Icono.jsx'

// El botón Cargar es solo para el cargador, que tiene un lugar: lo lleva directo a la próxima
// célula para cargar. El admin no tiene lugar, así que carga desde la tarjeta de cada célula.
// Es solo para mostrar u ocultar el botón: el permiso real lo valida el backend.
const items = [
  { a: '/inicio', texto: 'Inicio', icono: 'home' },
  { a: '/celulas', texto: 'Células', icono: 'grid_view' },
  { a: '/cargar', texto: 'Cargar', icono: 'add', destacado: true },
  { a: '/resultados', texto: 'Resultados', icono: 'insights' },
  { a: '/mas', texto: 'Más', icono: 'more_horiz' },
]

export default function BarraNavegacion() {
  const { usuario } = useSesion()
  const navigate = useNavigate()
  const [buscando, setBuscando] = useState(false)
  const lugarId = usuario?.rol === 'cargador' ? usuario.lugar?.id : null
  const itemsVisibles = items.filter((item) => !item.destacado || lugarId != null)

  // Igual que "Seguir cargando" del Inicio. Si no queda nada o falla, avisa sin cambiar de pantalla.
  async function irAProximaCelula(e) {
    e.preventDefault()
    if (buscando) return
    setBuscando(true)
    try {
      const celulaId = await buscarProximaCelula(lugarId, obtenerCelulasDeLugar)
      if (celulaId != null) navigate(`/cargar/${celulaId}`)
      else toast.success('Ya cargaste todas las células de este mes.')
    } catch (error) {
      toast.error(error.message)
    }
    setBuscando(false)
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
              onClick={item.destacado ? irAProximaCelula : undefined}
              aria-busy={item.destacado ? buscando : undefined}
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
                      <Icono nombre={buscando ? 'progress_activity' : item.icono} className={buscando ? 'animate-spin' : ''} />
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
