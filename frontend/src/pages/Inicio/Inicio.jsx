import { useEffect, useState } from 'react'
import { obtenerLugares } from '../../api.js'
import Cargando from '../../components/Cargando.jsx'
import MensajeError from '../../components/MensajeError.jsx'
import Titulo from '../../components/Titulo.jsx'
import Vacio from '../../components/Vacio.jsx'
import { useSesion } from '../../sesion/useSesion.js'
import TarjetaCargaDelMes from './TarjetaCargaDelMes.jsx'
import TarjetaLugar from './TarjetaLugar.jsx'

// Pantalla de inicio (T11, INI-01 a 04 y 07). INI-05 (últimas células) e INI-06 (mapa)
// quedan para otro ticket.
// Cada rol ve solo lo que le sirve: el cargador, cuánto le falta cargar en su lugar y el botón
// para seguir; el admin y el lector, la lista de lugares.
export default function Inicio() {
  const { usuario } = useSesion() // RutaPrivada ya garantiza que hay usuario

  const [carga, setCarga] = useState({ cargando: true })
  const [intento, setIntento] = useState(0) // al cambiarlo, el useEffect vuelve a pedir los datos

  useEffect(() => {
    // "cancelado" evita guardar la respuesta si el usuario ya salió de la pantalla.
    let cancelado = false
    obtenerLugares()
      .then((datos) => {
        if (!cancelado) setCarga({ datos })
      })
      .catch((error) => {
        if (!cancelado) setCarga({ error })
      })
    return () => {
      cancelado = true
    }
  }, [intento])

  function reintentar() {
    setCarga({ cargando: true })
    setIntento((n) => n + 1)
  }

  // Mostrar u ocultar cosas es solo experiencia de uso: el permiso real lo valida el backend.
  const esLector = usuario.rol === 'lector'
  const miLugarId = usuario.rol === 'cargador' ? usuario.lugar?.id : null

  return (
    <div className="flex flex-col gap-6 py-4">
      {/* INI-01: saludo */}
      <header className="flex flex-col gap-1">
        <Titulo className="font-titulo">Hola, {usuario.nombre}</Titulo>
        {/* INI-07: aviso de solo lectura */}
        {esLector && <p className="text-body-md text-texto-2">Podés ver los datos, pero no cargar.</p>}
      </header>

      <Contenido carga={carga} reintentar={reintentar} miLugarId={miLugarId} />
    </div>
  )
}

// Lo que depende de GET /api/lugares: la carga del mes del cargador y la lista de lugares,
// con sus estados cargando, error y vacío.
function Contenido({ carga, reintentar, miLugarId }) {
  if (carga.cargando) return <Cargando filas={3} />
  if (carga.error) return <MensajeError mensaje={carga.error.message} onReintentar={reintentar} />

  const { lugares, periodo, diasHastaVencimiento } = carga.datos
  if (lugares.length === 0) {
    return (
      <Vacio
        icono="location_on"
        titulo="Todavía no hay lugares"
        mensaje="Cuando el equipo de UCC Sostenible dé de alta un lugar, va a aparecer acá."
      />
    )
  }

  // INI-04: el lugar del cargador va primero; los demás siguen en el orden del backend (por letra).
  const miLugar = lugares.find((l) => l.id === miLugarId)
  const ordenados = miLugar ? [miLugar, ...lugares.filter((l) => l.id !== miLugarId)] : lugares

  return (
    <>
      {/* INI-02: solo el cargador ve el avance, y solo el de su lugar. */}
      {miLugar && (
        <TarjetaCargaDelMes
          lugarId={miLugar.id}
          cargadas={miLugar.avance.cargadas}
          total={miLugar.avance.total}
          periodo={periodo}
          diasHastaVencimiento={diasHastaVencimiento}
        />
      )}

      <section className="flex flex-col gap-3">
        <Titulo nivel="md" className="font-titulo">
          Lugares
        </Titulo>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ordenados.map((lugar) => (
            <li key={lugar.id}>
              <TarjetaLugar lugar={lugar} esMio={lugar.id === miLugarId} />
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
