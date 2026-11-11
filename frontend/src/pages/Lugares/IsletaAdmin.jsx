import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { obtenerIsleta } from '../../api.js'
import Cargando from '../../components/Cargando.jsx'
import Icono from '../../components/Icono.jsx'
import MensajeError from '../../components/MensajeError.jsx'
import Titulo from '../../components/Titulo.jsx'
import { useSesion } from '../../sesion/useSesion.js'
import CelulasEnLote from './CelulasEnLote.jsx'
import EditorPlano from './EditorPlano.jsx'
import { SinPermiso } from './Lugares.jsx'

// Pantalla de administración de una isleta (T20): el plano (LUG-05, LUG-06) y la creación de
// células en lote (LUG-07), en dos pestañas para que haya un solo botón principal a la vista.
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

const pestanas = [
  { id: 'plano', texto: 'Plano', icono: 'flight' },
  { id: 'lote', texto: 'Crear células', icono: 'add' },
]

function ContenidoIsleta() {
  const { id } = useParams()
  const [carga, setCarga] = useState({ cargando: true })
  const [intento, setIntento] = useState(0)
  const [pestana, setPestana] = useState('plano')
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
  // Después de guardar, se avisa acá (el editor arranca de cero) y se vuelve a pedir la isleta
  // (sin "cargando") para ver el plano y las células nuevas.
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

      <div role="tablist" aria-label="Qué querés hacer" className="flex gap-2 border-b border-borde">
        {pestanas.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            id={`pestana-${p.id}`}
            aria-selected={pestana === p.id}
            aria-controls={`panel-${p.id}`}
            onClick={() => setPestana(p.id)}
            className={`-mb-px flex min-h-12 items-center gap-2 border-b-[3px] px-3 text-label-md font-medium focus-visible:outline-2 focus-visible:outline-bosque-hover ${
              pestana === p.id ? 'border-bosque text-bosque' : 'border-transparent text-texto-2 hover:text-bosque'
            }`}
          >
            <Icono nombre={p.icono} tamano="chico" />
            {p.texto}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${pestana}`} aria-labelledby={`pestana-${pestana}`}>
        {/* key: al recargar la isleta, el editor arranca de cero con los datos nuevos. */}
        {pestana === 'plano' ? (
          <EditorPlano key={`plano-${intento}`} isleta={isleta} onGuardado={alGuardar} />
        ) : (
          <CelulasEnLote key={`lote-${intento}`} isleta={isleta} onGuardado={alGuardar} />
        )}
      </div>
    </>
  )
}
