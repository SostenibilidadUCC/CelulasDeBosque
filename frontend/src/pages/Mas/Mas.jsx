import { useState } from 'react'
import { Link } from 'react-router'
import { cerrarSesion } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import Icono from '../../components/Icono.jsx'
import Tarjeta from '../../components/Tarjeta.jsx'
import Titulo from '../../components/Titulo.jsx'
import { useSesion } from '../../sesion/useSesion.js'

// El backend manda el rol como "admin", "cargador" o "lector"; en pantalla nunca se muestra así.
const nombresDeRol = {
  admin: 'Administrador',
  cargador: 'Cargador',
  lector: 'Lector',
}

// "Magdalena Gómez" → "MG". Si hay una sola palabra, toma solo su primera letra.
function iniciales(nombre = '') {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => palabra[0].toUpperCase())
    .join('')
}

// Pantallas solo para el admin. El Código QR (T22) se suma acá cuando exista.
const seccionesAdmin = [
  { a: '/datos', texto: 'Tabla de datos' },
  { a: '/usuarios', texto: 'Usuarios' },
  { a: '/lugares', texto: 'Lugares e isletas' },
]

// Pantalla "Cuenta" (antes "Más"; la ruta sigue siendo /mas para no tocar App.jsx):
// los datos de la persona, las secciones del admin y cerrar sesión.
export default function Mas() {
  const { usuario } = useSesion()
  const [saliendo, setSaliendo] = useState(false)

  async function salir() {
    setSaliendo(true)
    try {
      await cerrarSesion()
    } catch {
      // Si falla el pedido, igual se limpia la sesión de la pantalla y se va a la presentación.
    }
    // Se recarga la app directo en la presentación ("/"), en lugar de navegar con React Router:
    // - arranca de cero, sin datos de la sesión anterior en memoria (importa en celulares compartidos);
    // - evita que RutaPrivada anote "desde: /mas" y el próximo login caiga en Más en vez del Inicio.
    // replace (y no assign) hace que el botón "atrás" no vuelva a esta pantalla.
    window.location.replace('/')
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <Titulo nivel="lg">Cuenta</Titulo>

      <Tarjeta className="flex flex-row items-center gap-4">
        {/* Las iniciales en un círculo, como foto de perfil. */}
        <span
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-bosque font-titulo text-headline-md font-semibold text-white"
        >
          {iniciales(usuario.nombre)}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="truncate text-headline-sm font-semibold text-texto">{usuario.nombre}</p>
          <p className="text-body-md text-texto-2">
            {nombresDeRol[usuario.rol] ?? usuario.rol}
            {usuario.lugar && ` · ${usuario.lugar.nombre}`}
          </p>
        </div>
      </Tarjeta>

      {/* T17 (ALT-01): Nueva célula, para el admin y el cargador. Se usa una sola vez por célula, el día
          de la plantación: por eso está acá y no en la barra. Va en su propio bloque, separado de
          Administración. Ocultarlo al lector es solo experiencia de uso: el backend valida el permiso. */}
      {(usuario.rol === 'admin' || usuario.rol === 'cargador') && (
        <section className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Titulo nivel="sm" como="h2">
              Plantación
            </Titulo>
            <p id="ayuda-plantacion" className="text-body-sm text-texto-2">
              Dá de alta cada célula el día que la plantás.
            </p>
          </div>
          <nav aria-label="Plantación">
            <ul className="overflow-hidden rounded-2xl border border-borde bg-superficie shadow-nivel-1">
              <li>
                <Link
                  to="/celulas/nueva"
                  aria-describedby="ayuda-plantacion"
                  className="flex min-h-14 items-center justify-between gap-3 px-4 text-label-lg font-medium text-texto hover:bg-tonal focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bosque-hover"
                >
                  <span className="flex items-center gap-3">
                    <Icono nombre="add" className="text-bosque" />
                    Nueva célula
                  </span>
                  <Icono nombre="chevron_right" className="text-texto-3" />
                </Link>
              </li>
            </ul>
          </nav>
        </section>
      )}

      {/* Las pantallas del admin. En celular no hay menú lateral: este es el único lugar donde están.
          Ocultarlas es solo experiencia de uso: el backend valida que sea admin. */}
      {usuario.rol === 'admin' && (
        <section className="flex flex-col gap-2">
          <Titulo nivel="sm" como="h2">
            Administración
          </Titulo>
          <nav aria-label="Administración">
            <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie shadow-nivel-1">
              {seccionesAdmin.map((seccion) => (
                <li key={seccion.a}>
                  <Link
                    to={seccion.a}
                    className="flex min-h-14 items-center justify-between gap-3 px-4 text-label-lg font-medium text-texto hover:bg-tonal focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bosque-hover"
                  >
                    {seccion.texto}
                    <Icono nombre="chevron_right" className="text-texto-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </section>
      )}

      <Boton variante="secundario" cargando={saliendo} textoCargando="Cerrando sesión…" onClick={salir}>
        Cerrar sesión
      </Boton>
    </div>
  )
}
