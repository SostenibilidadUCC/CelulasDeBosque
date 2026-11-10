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

// Pantallas para los tres roles (la v6 da la tabla de datos a admin, cargador y lector).
const seccionesTodos = [{ a: '/datos', texto: 'Tabla de datos' }]

// Pantallas solo para el admin. El Código QR (T22) se suma acá cuando exista.
const seccionesAdmin = [
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

      {/* En celular no hay menú lateral: este es el único lugar donde están estas pantallas. */}
      <ListaDeSecciones titulo="Datos" secciones={seccionesTodos} />

      {/* Ocultarlas es solo experiencia de uso: el backend valida que sea admin. */}
      {usuario.rol === 'admin' && <ListaDeSecciones titulo="Administración" secciones={seccionesAdmin} />}

      <Boton variante="secundario" cargando={saliendo} textoCargando="Cerrando sesión…" onClick={salir}>
        Cerrar sesión
      </Boton>
    </div>
  )
}

// Una lista de enlaces a otras pantallas, con su título.
function ListaDeSecciones({ titulo, secciones }) {
  return (
    <section className="flex flex-col gap-2">
      <Titulo nivel="sm" como="h2">
        {titulo}
      </Titulo>
      <nav aria-label={titulo}>
        <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie shadow-nivel-1">
          {secciones.map((seccion) => (
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
  )
}
