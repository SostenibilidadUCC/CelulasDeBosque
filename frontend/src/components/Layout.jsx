import { Outlet } from 'react-router'
import BarraNavegacion from './BarraNavegacion.jsx'

// Marco de las pantallas internas: contenido centrado y barra de navegación abajo.
export default function Layout() {
  return (
    <div className="min-h-svh pb-24">
      <main className="mx-auto max-w-3xl px-4">
        <Outlet />
      </main>
      <BarraNavegacion />
    </div>
  )
}