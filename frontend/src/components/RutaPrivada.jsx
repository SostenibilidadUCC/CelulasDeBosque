import { Navigate, useLocation } from 'react-router'
import { useSesion } from '../sesion/useSesion.js'
import Cargando from './Cargando.jsx'
import MensajeError from './MensajeError.jsx'

// Envuelve las pantallas internas: sin sesión manda al login y recuerda a dónde quería ir.
// Es solo experiencia de uso: el permiso real lo valida siempre el backend.
export default function RutaPrivada({ children }) {
  const { usuario, cargando, error, recargar } = useSesion()
  const location = useLocation()

  if (cargando) return <Cargando />
  if (error) {
    return (
      <div className="p-4">
        <MensajeError mensaje={error} onReintentar={recargar} />
      </div>
    )
  }
  if (!usuario) return <Navigate to="/login" replace state={{ desde: location.pathname }} />
  return children
}
