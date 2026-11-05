import { Outlet } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import BarraNavegacion from './BarraNavegacion.jsx'
import BarraSuperior from './BarraSuperior.jsx'

// Marco de las pantallas internas. Deja 96 px libres abajo para que la barra no tape el contenido.
// Toaster muestra los avisos ("¡Registro guardado!"): abajo y por encima de la barra en celular.
export default function Layout() {
  return (
    <div className="min-h-svh pb-24">
      <BarraSuperior />
      <main className="mx-auto max-w-[1120px] px-4 pt-2 sm:px-6 lg:px-10">
        <Outlet />
      </main>
      <BarraNavegacion />
      <Toaster position="bottom-center" offset={96} mobileOffset={96} duration={4000} visibleToasts={1} />
    </div>
  )
}
