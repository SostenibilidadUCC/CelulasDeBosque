import { Outlet } from 'react-router'
import BarraNavegacion from './BarraNavegacion.jsx'

// Marco de las pantallas internas. Deja 88 px libres abajo para que la barra no tape el contenido.
export default function Layout() {
  return (
    <div className="min-h-svh pb-[88px]">
      <main className="mx-auto max-w-[1120px] px-4 sm:px-6 lg:px-10">
        <Outlet />
      </main>
      <BarraNavegacion />
    </div>
  )
}