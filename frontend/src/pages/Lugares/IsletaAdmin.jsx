import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { obtenerIsleta } from '../../api.js'
import Cargando from '../../components/Cargando.jsx'
import Icono from '../../components/Icono.jsx'
import MensajeError from '../../components/MensajeError.jsx'
import Titulo from '../../components/Titulo.jsx'
import { useSesion } from '../../sesion/useSesion.js'
import CelulasEnLote from './CelulasEnLote.jsx'
import { SinPermiso } from './Lugares.jsx'

// Pantalla de administración de una isleta (T20): la creación de células en lote (LUG-07).
// La grilla del plano se elige al crear o editar la isleta (FormularioIsleta), sin foto de fondo.
// Ruta: /lugares/isletas/:id. Los datos salen de GET /api/isletas/{id}, el mismo que usa el Plano.
export default function IsletaAdmin() {
  const { usuario } = useSesion()
  return (
    <div className="flex flex-col gap-4 py-4">
      <Link
        to="/lugares"
        className="flex min-h-12 items-center gap-1 self-start rounded-lg text-label-md font-medium text-bosque underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-bosque-hover"
      >
        <Icono nombre="arrow_back" tamano="chico" />
        Lugares e isletas
      </Link>
      {usuario.rol === 'admin' ? <ContenidoIsleta /> : <SinPermiso />}
    </div>
  )
}

function ContenidoIsleta() {
  const { id } = useParams()
  const [carga, setCarga] = useState({ cargando: true })
  const [intento, setIntento] = useState(0)
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    let cancelado = false
    obtenerIsleta(id)
      .then((isleta) => {
        if (!cancelado) setCarga({ isleta })
      })
      .catch((error) => {
        if (!cancelado) setCarga({ error })
      })
    return () => {
      cancelado = true
    }
  }, [id, intento])

  // El aviso de "Listo…" se va solo a los 4 segundos.
  useEffect(() => {
    if (!aviso) return
    const temporizador = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(temporizador)
  }, [aviso])

  const recargar = () => setIntento((n) => n + 1)
  // Después de guardar, se avisa acá (el formulario arranca de cero) y se vuelve a pedir la isleta
  // (sin "cargando") para ver el plano con las células nuevas.
  function alGuardar(texto) {
    setAviso(texto)
    recargar()
  }

  if (carga.error) {
    return (
      <MensajeError
        mensaje={carga.error.estado === 404 ? 'Esta isleta no existe.' : carga.error.message}
        onReintentar={() => {
          setCarga({ cargando: true })
          recargar()
        }}
      />
    )
  }
  if (carga.cargando) return <Cargando filas={4} />

  const { isleta } = carga
  return (
    <>
      <div className="flex flex-col gap-1">
        <Titulo>
          Isleta {isleta.lugar.letra}-{isleta.numero}
        </Titulo>
        <p className="text-body-md text-texto-2">
          {isleta.lugar.nombre}
          {isleta.nombre && ` · ${isleta.nombre}`} · {isleta.celulas.length} {isleta.celulas.length === 1 ? 'célula' : 'células'}
        </p>
      </div>

      {aviso && (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-tonal p-3 text-body-md text-bosque">
          <Icono nombre="check_circle" className="shrink-0" />
          {aviso}
        </p>
      )}

      {/* key: al recargar la isleta, el formulario arranca de cero con los datos nuevos. */}
      <CelulasEnLote key={`lote-${intento}`} isleta={isleta} onGuardado={alGuardar} />
    </>
  )
}
