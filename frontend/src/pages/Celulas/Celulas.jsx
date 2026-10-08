import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { obtenerCelulasDeLugar, obtenerLugares } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import Cargando from '../../components/Cargando.jsx'
import Icono from '../../components/Icono.jsx'
import MensajeError from '../../components/MensajeError.jsx'
import Titulo from '../../components/Titulo.jsx'
import Vacio from '../../components/Vacio.jsx'
import { useSesion } from '../../sesion/useSesion.js'
import Filtros from './Filtros.jsx'
import TarjetaCelula from './TarjetaCelula.jsx'

// Pantalla Células (T11, EXP-01 a 05): elegir lugar, filtrar, buscar y ver las tarjetas.
// El lugar, la isleta, el estado y la búsqueda viven en la URL (?lugar=1&isleta=2&estado=pendiente&q=45).
// Así funcionan el enlace desde Inicio y el botón Atrás, y se puede compartir un filtro.
export default function Celulas() {
  const { usuario } = useSesion()
  const [parametros, setParametros] = useSearchParams()

  // 1. Los lugares (para el selector, las isletas y los accesos al plano).
  const [cargaLugares, setCargaLugares] = useState({ cargando: true })
  const [intentoLugares, setIntentoLugares] = useState(0)

  useEffect(() => {
    let cancelado = false
    obtenerLugares()
      .then((datos) => {
        if (!cancelado) setCargaLugares({ datos })
      })
      .catch((error) => {
        if (!cancelado) setCargaLugares({ error })
      })
    return () => {
      cancelado = true
    }
  }, [intentoLugares])

  // 2. EXP-01: el lugar elegido. Primero el de la URL; si no hay, el del cargador; si no, el primero.
  const lugares = cargaLugares.datos?.lugares ?? []
  const lugarEnUrl = parametros.get('lugar')
  const lugar = lugarEnUrl
    ? lugares.find((l) => String(l.id) === lugarEnUrl)
    : (lugares.find((l) => l.id === usuario.lugar?.id) ?? lugares[0])

  const isleta = parametros.get('isleta') ?? ''
  const estado = parametros.get('estado') ?? ''
  const q = parametros.get('q') ?? ''

  // 3. Las células del lugar con los filtros.
  // "clave" resume el pedido actual. Si la respuesta guardada es de otra clave (cambió un filtro
  // o se tocó Reintentar), se muestra "cargando" sin tener que avisarlo con otro estado.
  const [intentoCelulas, setIntentoCelulas] = useState(0)
  const [cargaCelulas, setCargaCelulas] = useState(null)
  const lugarId = lugar?.id
  const clave = `${lugarId}|${isleta}|${estado}|${q}|${intentoCelulas}`

  useEffect(() => {
    if (lugarId == null) return
    let cancelado = false
    obtenerCelulasDeLugar(lugarId, { isleta, estado, q })
      .then((datos) => {
        if (!cancelado) setCargaCelulas({ clave, datos })
      })
      .catch((error) => {
        if (!cancelado) setCargaCelulas({ clave, error })
      })
    return () => {
      cancelado = true
    }
  }, [lugarId, isleta, estado, q, clave])

  // Cambia uno o más filtros en la URL. Los vacíos se sacan para que la URL quede limpia.
  // setParametros agrega una entrada al historial: por eso el botón Atrás vuelve al filtro anterior.
  function cambiarFiltros(cambios) {
    const nuevos = { lugar: lugarId != null ? String(lugarId) : '', isleta, estado, q, ...cambios }
    setParametros(Object.fromEntries(Object.entries(nuevos).filter(([, valor]) => valor)))
  }

  // Estados de la pantalla mientras no hay lugares.
  if (cargaLugares.cargando) {
    return (
      <Pagina>
        <Cargando filas={4} />
      </Pagina>
    )
  }
  if (cargaLugares.error) {
    return (
      <Pagina>
        <MensajeError
          mensaje={cargaLugares.error.message}
          onReintentar={() => {
            setCargaLugares({ cargando: true })
            setIntentoLugares((n) => n + 1)
          }}
        />
      </Pagina>
    )
  }
  if (lugares.length === 0) {
    return (
      <Pagina>
        <Vacio icono="location_on" titulo="Todavía no hay lugares" mensaje="Cuando se dé de alta un lugar, sus células van a aparecer acá." />
      </Pagina>
    )
  }
  if (!lugar) {
    // ?lugar= con un lugar que no existe o está deshabilitado.
    return (
      <Pagina>
        <Vacio icono="search_off" titulo="No existe ese lugar" mensaje="Revisá el enlace o elegí otro lugar.">
          <Boton variante="secundario" onClick={() => setParametros({})}>
            Ver células
          </Boton>
        </Vacio>
      </Pagina>
    )
  }

  const cargandoCelulas = cargaCelulas?.clave !== clave
  const hayFiltros = Boolean(isleta || estado || q)

  return (
    <Pagina>
      <Filtros lugares={lugares} lugar={lugar} isleta={isleta} estado={estado} q={q} onCambiar={cambiarFiltros} />

      <AccesosPlano isletas={isleta ? lugar.isletas.filter((i) => String(i.id) === isleta) : lugar.isletas} />

      {cargandoCelulas ? (
        <Cargando filas={3} />
      ) : cargaCelulas.error ? (
        <MensajeError mensaje={cargaCelulas.error.message} onReintentar={() => setIntentoCelulas((n) => n + 1)} />
      ) : (
        <ListaCelulas
          respuesta={cargaCelulas.datos}
          hayFiltros={hayFiltros}
          limpiarFiltros={() => cambiarFiltros({ isleta: '', estado: '', q: '' })}
        />
      )}
    </Pagina>
  )
}

// Marco común de la pantalla: título y separación.
function Pagina({ children }) {
  return (
    <div className="flex flex-col gap-4 py-4">
      <Titulo>Células</Titulo>
      {children}
    </div>
  )
}

// Acceso "Ver plano" de cada isleta del lugar (o solo la filtrada).
function AccesosPlano({ isletas }) {
  const navigate = useNavigate()
  if (isletas.length === 0) return null
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {isletas.map((i) => (
        <Boton key={i.id} variante="secundario" icono="flight" onClick={() => navigate(`/isletas/${i.id}`)}>
          Ver plano de la isleta {i.numero}
        </Boton>
      ))}
    </div>
  )
}

// La lista de tarjetas con el aviso de solo lectura (EXP-04) y el estado vacío (EXP-05).
function ListaCelulas({ respuesta, hayFiltros, limpiarFiltros }) {
  const { celulas, puedeEditar } = respuesta

  if (celulas.length === 0) {
    return hayFiltros ? (
      <Vacio icono="search_off" titulo="No hay células con esos filtros" mensaje="Probá con otra isleta, otro estado u otra búsqueda.">
        <Boton variante="secundario" icono="filter_alt_off" onClick={limpiarFiltros}>
          Limpiar filtros
        </Boton>
      </Vacio>
    ) : (
      <Vacio icono="grid_view" titulo="Este lugar todavía no tiene células" mensaje="Cuando se dé de alta una célula, va a aparecer acá." />
    )
  }

  return (
    <>
      {!puedeEditar && (
        <p className="flex items-start gap-2 rounded-2xl bg-tonal p-4 text-body-md text-bosque">
          <Icono nombre="visibility" tamano="chico" className="mt-0.5" />
          Tenés acceso de solo lectura en este lugar: podés ver las células, pero no cargar registros.
        </p>
      )}
      <p className="text-body-md text-texto-2" aria-live="polite">
        {celulas.length === 1 ? '1 célula' : `${celulas.length} células`}
      </p>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {celulas.map((c) => (
          <li key={c.id}>
            <TarjetaCelula celula={c} puedeEditar={puedeEditar} />
          </li>
        ))}
      </ul>
    </>
  )
}
