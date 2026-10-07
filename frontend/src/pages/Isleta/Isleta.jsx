import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { obtenerIsleta } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import Cargando from '../../components/Cargando.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import ChipEstado from '../../components/ChipEstado.jsx'
import CodigoCelula from '../../components/CodigoCelula.jsx'
import Icono from '../../components/Icono.jsx'
import MensajeError from '../../components/MensajeError.jsx'
import PanelInferior from '../../components/PanelInferior.jsx'
import Plano from '../../components/Plano.jsx'
import Titulo from '../../components/Titulo.jsx'
import Vacio from '../../components/Vacio.jsx'

// Zoom de la grilla: lado de cada celda en px. 36 px es el mínimo de frontend/CLAUDE.md.
const TAMANO_MINIMO = 36
const TAMANO_MAXIMO = 72
const PASO_ZOOM = 8

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
  const [vista, setVista] = useState('plano')
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
  }, [resaltadaId, vista])

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
        <Boton variante="secundario" onClick={() => navigate('/')}>
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
  const { celulas } = isleta
  const tienePlano = isleta.planoFotoId != null
  const vistaActual = tienePlano ? vista : 'lista' // ISL-06: sin plano, solo lista

  // ISL-02: contadores. "Cargadas" incluye las cargadas fuera de término.
  const cantidad = (...estados) => celulas.filter((c) => estados.includes(c.estado)).length
  const hayEstados = celulas.some((c) => c.estado && c.estado !== 'baja')
  const libres = isleta.filas * isleta.columnas - celulas.length

  // EXP-02: acepta el código completo (A-1-45) o solo el número (45).
  function buscar(e) {
    e.preventDefault()
    const texto = busqueda.trim().toUpperCase()
    if (!texto) return
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
      <header className="flex flex-col gap-1">
        <p className="text-body-md text-texto-2">
          {isleta.lugar.nombre} › Isleta {isleta.numero}
        </p>
        <Titulo nivel="lg">
          Isleta {isleta.numero}
          {isleta.nombre && <span className="font-normal text-texto-2"> · {isleta.nombre}</span>}
        </Titulo>
        <p className="text-body-md text-texto-2 tabular-nums">
          {hayEstados
            ? `Cargadas: ${cantidad('al-dia', 'fuera-de-termino')} · Pendientes: ${cantidad('pendiente')} · Libres: ${libres}`
            : `${celulas.length} células · ${libres} celdas libres`}
        </p>
      </header>

      {celulas.length === 0 ? (
        <Vacio icono="grid_view" titulo="Todavía no hay células en esta isleta" mensaje="Cuando se den de alta, van a aparecer acá." />
      ) : (
        <>
          <form onSubmit={buscar} className="flex items-end gap-2">
            <div className="flex-1">
              <CampoTexto
                etiqueta="Buscar célula"
                placeholder={`${isleta.lugar.letra}-${isleta.numero}-45 o 45`}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                autoCapitalize="characters"
                error={avisoBusqueda}
              />
            </div>
            <button
              type="submit"
              aria-label="Buscar"
              className={`flex size-12 shrink-0 items-center justify-center rounded-xl bg-bosque text-white hover:bg-bosque-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque-hover ${
                avisoBusqueda ? 'mb-6' : ''
              }`}
            >
              <Icono nombre="search" />
            </button>
          </form>

          {tienePlano ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex rounded-full bg-segmento p-1" role="group" aria-label="Cómo ver las células">
                {[
                  { valor: 'plano', texto: 'Plano', icono: 'flight' },
                  { valor: 'lista', texto: 'Lista', icono: 'format_list_bulleted' },
                ].map((opcion) => (
                  <button
                    key={opcion.valor}
                    type="button"
                    aria-pressed={vista === opcion.valor}
                    onClick={() => setVista(opcion.valor)}
                    className={`flex min-h-10 items-center gap-1 rounded-full px-4 text-label-md transition duration-150 ease-out focus-visible:outline-2 focus-visible:outline-bosque-hover ${
                      vista === opcion.valor ? 'bg-superficie font-semibold text-bosque shadow-nivel-1' : 'text-texto-2'
                    }`}
                  >
                    <Icono nombre={opcion.icono} tamano="chico" />
                    {opcion.texto}
                  </button>
                ))}
              </div>

              {vista === 'plano' && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setTamano((t) => Math.max(TAMANO_MINIMO, t - PASO_ZOOM))}
                    disabled={tamano <= TAMANO_MINIMO}
                    aria-label="Alejar"
                    className="flex size-12 items-center justify-center rounded-xl text-bosque hover:bg-tonal disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-bosque-hover"
                  >
                    <Icono nombre="zoom_out" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTamano((t) => Math.min(TAMANO_MAXIMO, t + PASO_ZOOM))}
                    disabled={tamano >= TAMANO_MAXIMO}
                    aria-label="Acercar"
                    className="flex size-12 items-center justify-center rounded-xl text-bosque hover:bg-tonal disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-bosque-hover"
                  >
                    <Icono nombre="zoom_in" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="flex items-center gap-2 rounded-xl bg-tonal p-3 text-body-md text-bosque">
              <Icono nombre="info" tamano="chico" />
              Esta isleta todavía no tiene plano. Mientras tanto, las células se ven en lista.
            </p>
          )}

          {vistaActual === 'plano' ? (
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
              // TODO (T13 de Magda): imagenUrl={`/api/fotos/${isleta.planoFotoId}`}
            />
          ) : (
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
function PanelCelula({ celula, puedeEditar, onCargar, onVerFicha }) {
  const registro = celula.ultimoRegistro
  const puedeCargar = puedeEditar && celula.estado !== 'baja'

  return (
    <div className="flex flex-col gap-4">
      {celula.estado && <ChipEstado estado={celula.estado} />}

      {/* TODO (T13 de Magda): foto del último registro con /api/fotos/{registro.fotoId}. */}

      {registro ? (
        <div className="flex flex-col gap-2">
          <p className="text-body-md text-texto-2">Último registro: {fechaCorta(registro.fecha)}</p>
          <ul className="flex flex-col gap-2">
            {registro.individuos.map((ind) => (
              <li key={ind.formaDeVida} className="flex items-center gap-3">
                <Icono nombre={ind.icono} className="text-bosque-hover" />
                <span className="flex-1 text-body-lg text-texto">{ind.nombre}</span>
                {ind.vivo === false ? (
                  <ChipEstado estado="muerto" />
                ) : ind.vivo ? (
                  <>
                    <span className="text-body-md text-texto-2 tabular-nums">{ind.alturaCm} cm</span>
                    <ChipEstado estado="vivo" />
                  </>
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

      <div className="flex flex-col gap-2">
        {puedeCargar && (
          <Boton icono="edit_note" onClick={onCargar}>
            Cargar registro
          </Boton>
        )}
        <Boton variante="secundario" onClick={onVerFicha}>
          Ver ficha
        </Boton>
        {!puedeEditar && (
          <p className="flex items-center gap-2 text-body-sm text-texto-3">
            <Icono nombre="lock" tamano="chip" />
            Tenés acceso de solo lectura en este lugar.
          </p>
        )}
      </div>
    </div>
  )
}