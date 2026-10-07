import { useState } from 'react'
import { cerrarSesion } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import Tarjeta from '../../components/Tarjeta.jsx'
import Titulo from '../../components/Titulo.jsx'
import { useSesion } from '../../sesion/useSesion.js'

// El backend manda el rol como "admin", "cargador" o "lector"; en pantalla nunca se muestra así.
const nombresDeRol = {
  admin: 'Administrador',
  cargador: 'Cargador',
  lector: 'Lector',
}

export default function Mas() {
  const { usuario } = useSesion()
  const [saliendo, setSaliendo] = useState(false)

  async function salir() {
    setSaliendo(true)
    try {
      await cerrarSesion()
    } catch {
      // Si falla el pedido, igual se limpia la sesión de la pantalla y se va al login.
    }
    // Se recarga la app directo en el login, en lugar de navegar con React Router:
    // - arranca de cero, sin datos de la sesión anterior en memoria (importa en celulares compartidos);
    // - evita que RutaPrivada anote "desde: /mas" y el próximo login caiga en Más en vez del Inicio.
    // replace (y no assign) hace que el botón "atrás" no vuelva a esta pantalla.
    window.location.replace('/login')
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <Titulo nivel="lg">Más</Titulo>

      <Tarjeta className="flex flex-col gap-1">
        <p className="text-headline-sm font-semibold text-texto">{usuario.nombre}</p>
        <p className="text-body-md text-texto-2">{nombresDeRol[usuario.rol] ?? usuario.rol}</p>
        {usuario.lugar && (
          <p className="text-body-md text-texto-2">
            Lugar {usuario.lugar.letra} · {usuario.lugar.nombre}
          </p>
        )}
      </Tarjeta>

      <Boton variante="secundario" icono="logout" cargando={saliendo} textoCargando="Cerrando sesión…" onClick={salir}>
        Cerrar sesión
      </Boton>
    </div>
  )
}
