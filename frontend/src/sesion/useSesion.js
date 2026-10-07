import { useContext } from 'react'
import { ContextoSesion } from './contextoSesion.js'

// Uso: const { usuario } = useSesion()  // usuario es { id, nombre, email, rol, lugar } o null
export function useSesion() {
  return useContext(ContextoSesion)
}
