import { createContext } from 'react'

// Guarda { usuario, cargando, error, setUsuario, recargar }. Se llena en ProveedorSesion.
export const ContextoSesion = createContext(null)
