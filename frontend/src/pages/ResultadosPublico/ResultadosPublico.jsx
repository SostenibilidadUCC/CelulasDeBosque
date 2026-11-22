import { useNavigate } from 'react-router'
import Boton from '../../components/Boton.jsx'
import Icono from '../../components/Icono.jsx'
import { useSesion } from '../../sesion/useSesion.js'
import Resultados from '../Resultados/Resultados.jsx'

// Resultados públicos (ruta /como-crecen, T22): la misma pantalla de Resultados, sin sesión y sin la
// barra de navegación de la app. Es adonde lleva "Ver cómo crecen" de la presentación (D1 y D2).
// Arriba, como pide el DESIGN.md para la página pública, solo el logo y un botón discreto "Ingresar".
export default function ResultadosPublico() {
  const navigate = useNavigate()
  const { usuario } = useSesion()

  return (
    <div className="min-h-svh bg-fondo">
      <header className="border-b border-borde bg-superficie">
        <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
          {/* El logo vuelve a la presentación. */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex min-h-12 items-center gap-2 rounded-xl text-bosque focus-visible:outline-2 focus-visible:outline-bosque-hover"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-tonal">
              <Icono nombre="park" relleno />
            </span>
            <span className="flex flex-col items-start leading-tight">
              <span className="font-titulo text-headline-sm font-semibold">Células de Bosque</span>
              <span className="text-body-sm text-texto-2">UCC Sostenible</span>
            </span>
          </button>
          <Boton
            variante="secundario"
            icono={usuario ? 'home' : 'login'}
            className="w-auto"
            onClick={() => navigate(usuario ? '/inicio' : '/login')}
          >
            {usuario ? 'Ir a mi inicio' : 'Ingresar'}
          </Boton>
        </div>
      </header>

      <main className="mx-auto max-w-[1120px] px-4 pb-12 sm:px-6 lg:px-10">
        <Resultados publico />
      </main>
    </div>
  )
}
