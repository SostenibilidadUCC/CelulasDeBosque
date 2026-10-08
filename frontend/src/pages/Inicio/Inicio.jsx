import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { obtenerLugares } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import Cargando from '../../components/Cargando.jsx'
import Icono from '../../components/Icono.jsx'
import MensajeError from '../../components/MensajeError.jsx'
import Titulo from '../../components/Titulo.jsx'
import Vacio from '../../components/Vacio.jsx'
import { useSesion } from '../../sesion/useSesion.js'
import AvanceMes from './AvanceMes.jsx'
import TarjetaLugar from './TarjetaLugar.jsx'

const nombresDeRol = { admin: 'Administrador', cargador: 'Cargador', lector: 'Lector' }

// Pantalla de inicio (T11, INI-01 a 04 y 07). INI-05 (últimas células) e INI-06 (mapa)
// quedan para otro ticket.
export default function Inicio() {
  const { usuario } = useSesion() // RutaPrivada ya garantiza que hay usuario
  const navigate = useNavigate()

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

  // Mostrar u ocultar botones es solo experiencia de uso: el permiso real lo valida el backend.
  const esLector = usuario.rol === 'lector'
  const miLugarId = usuario.rol === 'cargador' ? usuario.lugar?.id : null

  return (
    <div className="flex flex-col gap-6 py-4">
      {/* INI-01: saludo y rol */}
      <header>
        <Titulo>Hola, {usuario.nombre}</Titulo>
        <p className="mt-1 text-body-md text-texto-2">
          {nombresDeRol[usuario.rol]}
          {usuario.rol === 'cargador' && usuario.lugar && ` · ${usuario.lugar.nombre}`}
        </p>
      </header>

      {/* INI-07: aviso de solo lectura */}
      {esLector && (
        <p className="flex items-start gap-2 rounded-2xl bg-tonal p-4 text-body-md text-bosque">
          <Icono nombre="visibility" tamano="chico" className="mt-0.5" />
          Tenés acceso de solo lectura: podés ver todos los lugares y sus células, pero no cargar ni editar datos.
        </p>
      )}

      {/* INI-03: accesos rápidos (no aparecen para el lector) */}
      {!esLector && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Boton icono="edit_note" onClick={() => navigate('/cargar')}>
            Carga mensual
          </Boton>
          <Boton variante="secundario" icono="add" onClick={() => navigate('/celulas/nueva')}>
            Nueva célula
          </Boton>
        </div>
      )}

      <Contenido carga={carga} reintentar={reintentar} rol={usuario.rol} miLugarId={miLugarId} />
    </div>
  )
}

// Lo que depende de GET /api/lugares: avance del mes y tarjetas de lugares, con sus estados
// cargando, error y vacío.
function Contenido({ carga, reintentar, rol, miLugarId }) {
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

  // INI-02: el cargador ve su lugar; el admin, todos sumados. El lector no ve el avance.
  // reduce recorre la lista y va acumulando: arranca en 0 y le suma lo de cada lugar.
  let avance = null
  if (rol === 'cargador' && miLugar) {
    avance = { ...miLugar.avance, lugar: miLugar.nombre }
  } else if (rol === 'admin') {
    avance = {
      cargadas: lugares.reduce((suma, l) => suma + l.avance.cargadas, 0),
      total: lugares.reduce((suma, l) => suma + l.avance.total, 0),
    }
  }

  return (
    <>
      {avance && (
        <AvanceMes
          cargadas={avance.cargadas}
          total={avance.total}
          lugar={avance.lugar}
          periodo={periodo}
          diasHastaVencimiento={diasHastaVencimiento}
        />
      )}

      <section className="flex flex-col gap-3">
        <Titulo nivel="md">Lugares</Titulo>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
