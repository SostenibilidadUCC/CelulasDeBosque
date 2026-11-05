import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { obtenerIsleta } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import Cargando from '../../components/Cargando.jsx'
import ChipEstado from '../../components/ChipEstado.jsx'
import CodigoCelula from '../../components/CodigoCelula.jsx'
import Icono from '../../components/Icono.jsx'
import MensajeError from '../../components/MensajeError.jsx'
import PanelInferior from '../../components/PanelInferior.jsx'
import Plano from '../../components/Plano.jsx'
import Titulo from '../../components/Titulo.jsx'
import Vacio from '../../components/Vacio.jsx'
import Buscador from '../Celulas/Buscador.jsx'

// Zoom de la grilla (con dos dedos): lado de cada celda en px. 36 px es el mínimo de frontend/CLAUDE.md.
const TAMANO_MINIMO = 36
const TAMANO_MAXIMO = 72

// Estados en los que falta el registro del mes: solo ahí se ofrece cargarlo.
const FALTA_CARGAR = ['pendiente', 'sin-registro']

const formatoMes = new Intl.DateTimeFormat('es-AR', { month: 'short' })

// "2026-11-18" → "18 nov 2026" (formato de fechas en tarjetas, frontend/CLAUDE.md).
// La fecha se arma con sus partes para que la zona horaria no la corra un día.
function fechaCorta(texto) {
  const [anio, mes, dia] = texto.split('-').map(Number)
  const nombreMes = formatoMes.format(new Date(anio, mes - 1, 1)).replace('.', '')
  return `${dia} ${nombreMes} ${anio}`
}

// Pantalla del plano de una isleta (T12, ISL-01 a 06). Es la que usa el cargador en el campo
// para encontrar la célula sin carteles.
export default function Isleta() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [carga, setCarga] = useState({ cargando: true })
  const [intento, setIntento] = useState(0)
  const [tamano, setTamano] = useState(44)
  const [busqueda, setBusqueda] = useState('')
  const [avisoBusqueda, setAvisoBusqueda] = useState(null)
  const [resaltadaId, setResaltadaId] = useState(null)
  const [seleccionada, setSeleccionada] = useState(null)

  useEffect(() => {
    let cancelado = false
    obtenerIsleta(id)
      .then((datos) => {
        if (!cancelado) setCarga({ datos })
      })
      .catch((error) => {
        if (!cancelado) setCarga({ error })
      })
    return () => {
      cancelado = true
    }
  }, [id, intento])

  // ISL-05: la célula buscada se centra en pantalla, tanto en el plano como en la lista.
  useEffect(() => {
    if (resaltadaId == null) return
    document
      .querySelector(`[data-celula="${resaltadaId}"]`)
      ?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
  }, [resaltadaId])

  function reintentar() {
    setCarga({ cargando: true })
    setIntento((n) => n + 1)
  }

  if (carga.cargando) {
    return (
      <div className="py-4">
        <Cargando filas={4} />
      </div>
    )
  }

  if (carga.error?.estado === 404) {
    return (
      <Vacio icono="search_off" titulo="No existe esa isleta" mensaje="Revisá el enlace o volvé al inicio.">
        <Boton variante="secundario" onClick={() => navigate('/inicio')}>
          Volver al inicio
        </Boton>
      </Vacio>
    )
  }

  if (carga.error) {
    return (
      <div className="py-4">
        <MensajeError mensaje={carga.error.message} onReintentar={reintentar} />
      </div>
    )
  }

  const isleta = carga.datos
  const tienePlano = isleta.planoFotoId != null // ISL-06: sin plano, se ven en lista

  // El estado del mes solo le sirve a quien carga en este lugar (admin o su cargador; el backend
  // lo calcula en puedeEditar con auth.PuedeEditarLugar). Al resto se le muestran las células
  // sin estado, salvo "Dada de baja", que no depende del mes.
  const veEstados = isleta.puedeEditar
  const celulas = veEstados
    ? isleta.celulas
    : isleta.celulas.map((c) => ({ ...c, estado: c.estado === 'baja' ? 'baja' : undefined }))

  // ISL-02: contadores. "Cargadas" incluye las cargadas fuera de término.
  const cantidad = (...estados) => celulas.filter((c) => estados.includes(c.estado)).length
  const hayEstados = celulas.some((c) => c.estado && c.estado !== 'baja')

  // EXP-02: acepta el código completo (A-1-45) o solo el número (45). Con el campo vacío, se
  // saca el resaltado.
  function buscar(textoBuscado) {
    setBusqueda(textoBuscado)
    const texto = textoBuscado.toUpperCase()
    if (!texto) {
      setResaltadaId(null)
      setAvisoBusqueda(null)
      return
    }
    const encontrada =
      celulas.find((c) => c.codigo.toUpperCase() === texto) ??
      (/^\d+$/.test(texto) ? celulas.find((c) => c.numero === Number(texto)) : undefined)

    if (encontrada) {
      setResaltadaId(encontrada.id)
      setAvisoBusqueda(null)
    } else {
      setResaltadaId(null)
      setAvisoBusqueda(`No hay ninguna célula ${texto} en esta isleta.`)
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      {/* Encabezado en tarjeta, igual que la ficha: la isleta y, debajo, el lugar. */}
      <header className="flex flex-col gap-3 rounded-2xl border border-borde bg-superficie p-4 shadow-nivel-1 sm:p-5">
        <div>
          <Titulo nivel="lg">
            Isleta {isleta.numero}
            {isleta.nombre && <span className="font-normal text-texto-2"> · {isleta.nombre}</span>}
          </Titulo>
          {/* El código de la isleta (A-1), con la misma pastilla que los códigos de célula: así se
              entiende que buscar "45" es buscar la A-1-45. */}
          <p className="mt-1 flex items-center gap-2 text-body-md text-texto-2">
            {isleta.lugar.nombre}
            <CodigoCelula codigo={`${isleta.lugar.letra}-${isleta.numero}`} />
          </p>
        </div>
        {/* Contadores como chips (frontend/CLAUDE.md, Plano de isleta): con texto y color,
            para que no dependa solo del color. */}
        {hayEstados && (
          <ul className="flex flex-wrap gap-2 tabular-nums">
            <Contador clases="border-brote-borde bg-brote text-bosque">
              Cargadas: {cantidad('al-dia', 'fuera-de-termino')}
            </Contador>
            <Contador clases="border-pendiente-borde bg-pendiente text-pendiente-texto">
              Pendientes: {cantidad('pendiente')}
            </Contador>
          </ul>
        )}
      </header>

      {celulas.length === 0 ? (
        <Vacio icono="grid_view" titulo="Todavía no hay células en esta isleta" mensaje="Cuando se den de alta, van a aparecer acá." />
      ) : (
        <>
          {/* El mismo buscador que Células: lupa adentro, X para borrar y búsqueda al dejar de escribir.
              Acá ya se sabe el lugar y la isleta, así que pide solo el número, con teclado numérico.
              Si alguien escribe el código completo (A-1-45), también lo encuentra. */}
          <div className="flex flex-col gap-1.5">
            <Buscador inicial={busqueda} onBuscar={buscar} etiqueta="Número de célula" placeholder="45" soloNumero />
            {avisoBusqueda && (
              <p role="alert" className="flex items-center gap-1.5 text-body-sm text-error">
                <Icono nombre="error" tamano="chico" />
                {avisoBusqueda}
              </p>
            )}
          </div>

          {tienePlano ? (
            <Plano
              filas={isleta.filas}
              columnas={isleta.columnas}
              celulas={celulas}
              tamanoCelda={tamano}
              tamanoMinimo={TAMANO_MINIMO}
              tamanoMaximo={TAMANO_MAXIMO}
              onCambiarTamano={setTamano} // ISL-01: zoom con dos dedos
              resaltadaId={resaltadaId}
              onSeleccionar={setSeleccionada}
              imagenUrl={`/api/fotos/${isleta.planoFotoId}`}
            />
          ) : (
            <>
              <p className="flex items-center gap-2 rounded-xl bg-tonal p-3 text-body-md text-bosque">
                <Icono nombre="info" tamano="chico" />
                Esta isleta todavía no tiene plano. Mientras tanto, las células se ven en lista.
              </p>
              <ul className="flex flex-col gap-2">
                {celulas.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      data-celula={c.id}
                      onClick={() => setSeleccionada(c)}
                      className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border bg-superficie px-4 py-3 text-left shadow-nivel-1 focus-visible:outline-2 focus-visible:outline-bosque-hover ${
                        c.id === resaltadaId ? 'border-bosque-hover ring-[3px] ring-hoja/25' : 'border-borde'
                      }`}
                    >
                      <span className="flex flex-1 flex-col items-start gap-1">
                        <CodigoCelula codigo={c.codigo} />
                        <span className="text-body-sm text-texto-3">
                          {c.ultimoRegistro ? `Último registro: ${fechaCorta(c.ultimoRegistro.fecha)}` : 'Sin registros'}
                        </span>
                      </span>
                      {c.estado && <ChipEstado estado={c.estado} />}
                      <Icono nombre="chevron_right" className="text-texto-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <PanelInferior
        abierto={seleccionada != null}
        titulo={seleccionada ? `Célula ${seleccionada.codigo}` : ''}
        onCerrar={() => setSeleccionada(null)}
      >
        {seleccionada && (
          <PanelCelula
            key={seleccionada.id}
            celula={seleccionada}
            puedeEditar={isleta.puedeEditar}
            onCargar={() => navigate(`/cargar/${seleccionada.id}`)}
            onVerFicha={() => navigate(`/celulas/${seleccionada.id}`)}
          />
        )}
      </PanelInferior>
    </div>
  )
}

// ISL-03: contenido del panel que se abre al tocar una célula.
// La célula ya llega sin estado si la persona no carga en este lugar.
function PanelCelula({ celula, puedeEditar, onCargar, onVerFicha }) {
  const registro = celula.ultimoRegistro
  const puedeCargar = puedeEditar && FALTA_CARGAR.includes(celula.estado)
  const [fotoFallo, setFotoFallo] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      {celula.estado && <ChipEstado estado={celula.estado} />}

      {/* Foto del último registro (GET /api/fotos/{id} revisa permisos). Si no carga, se oculta. */}
      {registro?.fotoId != null && !fotoFallo && (
        <img
          src={`/api/fotos/${registro.fotoId}`}
          alt={`Foto de la célula ${celula.codigo}, ${fechaCorta(registro.fecha)}`}
          onError={() => setFotoFallo(true)}
          className="aspect-[4/3] w-full rounded-xl bg-gris-suave object-cover"
        />
      )}

      {registro ? (
        <div className="flex flex-col gap-2">
          <p className="text-body-md text-texto-2">Último registro: {fechaCorta(registro.fecha)}</p>
          {/* Cada individuo con su altura; solo se marca el que está muerto. */}
          <ul className="flex flex-col gap-2">
            {registro.individuos.map((ind) => (
              <li key={ind.formaDeVida} className="flex items-center gap-3">
                <Icono nombre={ind.icono} className="text-bosque-hover" />
                <span className="flex-1 text-body-lg text-texto">{ind.nombre}</span>
                {ind.vivo === false ? (
                  <ChipEstado estado="muerto" />
                ) : ind.vivo ? (
                  <span className="text-body-md text-texto-2 tabular-nums">{ind.alturaCm} cm</span>
                ) : (
                  <span className="text-body-sm text-texto-3">Sin datos</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-body-md text-texto-2">Todavía no tiene registros.</p>
      )}

      {/* Un solo botón principal: si no hay que cargar, "Ver ficha" pasa a ser el principal. */}
      <div className="flex flex-col gap-2">
        {puedeCargar && (
          <Boton icono="edit_note" onClick={onCargar}>
            Cargar registro del mes
          </Boton>
        )}
        <Boton variante={puedeCargar ? 'secundario' : 'primario'} onClick={onVerFicha}>
          Ver ficha
        </Boton>
      </div>
    </div>
  )
}

// Chip de contador del encabezado (mismo tamaño que ChipEstado). Sin ícono: el texto ya dice qué cuenta.
function Contador({ clases, children }) {
  return (
    <li className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-label-sm ${clases}`}>
      {children}
    </li>
  )
}
