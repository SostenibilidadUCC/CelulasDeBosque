import { useCallback, useEffect, useMemo, useState } from 'react'
import { obtenerYo } from '../api.js'
import { ContextoSesion } from './contextoSesion.js'

// Pregunta quién está logueado y devuelve { usuario, error }. Nunca lanza.
async function consultarUsuario() {
  try {
    return { usuario: await obtenerYo(), error: null }
  } catch (e) {
    // 401 y 403 significan "no hay sesión": no es un error para mostrar, solo hay que ir al login.
    // Cualquier otro caso (sin conexión, 500) sí se avisa, para no mandar al login sin explicar nada.
    const sinSesion = e.estado === 401 || e.estado === 403
    return { usuario: null, error: sinSesion ? null : e.message }
  }
}

// Pregunta al backend quién está logueado cuando arranca la app y comparte la respuesta con todas las pantallas.
export default function ProveedorSesion({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const aplicar = useCallback((resultado) => {
    setUsuario(resultado.usuario)
    setError(resultado.error)
    setCargando(false)
  }, [])

  // Para el botón "Reintentar".
  const recargar = useCallback(() => {
    setCargando(true)
    setError(null)
    return consultarUsuario().then(aplicar)
  }, [aplicar])

  // Primera carga: `cargando` ya arranca en true, así que acá no hace falta ponerlo.
  useEffect(() => {
    let cancelado = false
    consultarUsuario().then((resultado) => {
      if (!cancelado) aplicar(resultado)
    })
    return () => {
      cancelado = true
    }
  }, [aplicar])

  const valor = useMemo(
    () => ({ usuario, cargando, error, setUsuario, recargar }),
    [usuario, cargando, error, recargar],
  )

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>
}
