import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { obtenerCelulasDeLugar } from '../../api.js'
import Cargando from '../../components/Cargando.jsx'
import Icono from '../../components/Icono.jsx'
import MensajeError from '../../components/MensajeError.jsx'
import PanelInferior from '../../components/PanelInferior.jsx'

// Estados en los que a la célula todavía le falta el registro del mes.
const FALTA_CARGAR = ['pendiente', 'sin-registro']

// Panel "Elegí la célula": isletas del lugar (si hay más de una) y una grilla con los números.
// Las que faltan cargar van en ámbar; las cargadas, con tilde (tocarlas abre la edición del mes).
// Lo abren el botón Cargar de la barra y el encabezado de la carga (ElegirCelula).
// Props:
// - abierto, onCerrar
// - lugarId: el lugar cuyas células se muestran.
// - isletaId (opcional): la isleta que se ve al abrir. Si no viene, la de la primera célula que
//   falta cargar (o la primera isleta, si están todas cargadas).
// - celulaActualId (opcional): la célula que se está cargando, marcada con un anillo.
export default function PanelElegirCelula({ abierto, onCerrar, ...resto }) {
  // El contenido se monta recién cuando el panel se abre (el Drawer no dibuja lo que está cerrado):
  // así cada vez que se abre arranca "cargando" y pide la lista de nuevo, sin setState en un efecto.
  return (
    <PanelInferior abierto={abierto} titulo="Elegí la célula" onCerrar={onCerrar}>
      <Contenido onCerrar={onCerrar} {...resto} />
    </PanelInferior>
  )
}

function Contenido({ onCerrar, lugarId, isletaId, celulaActualId }) {
  const navigate = useNavigate()
  // Las células del lugar se piden cada vez que se abre el panel: { cargando } | { error } | { celulas }.
  const [lista, setLista] = useState({ cargando: true })
  const [isletaElegida, setIsletaElegida] = useState(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    if (lugarId == null) return
    let cancelado = false // si se cierra antes de que llegue la respuesta, no se usa
    obtenerCelulasDeLugar(lugarId)
      .then(({ celulas }) => {
        if (cancelado) return
        setLista({ celulas })
        const primeraQueFalta = celulas.find((c) => FALTA_CARGAR.includes(c.estado))
        setIsletaElegida(isletaId ?? primeraQueFalta?.isleta.id ?? celulas[0]?.isleta.id ?? null)
      })
      .catch((error) => {
        if (!cancelado) setLista({ error })
      })
    return () => {
      cancelado = true
    }
  }, [lugarId, isletaId, intento])

  function reintentar() {
    setLista({ cargando: true })
    setIntento((n) => n + 1)
  }

  function ir(id) {
    onCerrar()
    if (id !== celulaActualId) navigate(`/cargar/${id}`)
  }

  const celulas = lista.celulas ?? []
  // Las isletas que aparecen en la lista, sin repetir y en orden.
  const isletas = []
  for (const c of celulas) {
    if (!isletas.some((i) => i.id === c.isleta.id)) isletas.push(c.isleta)
  }
  isletas.sort((a, b) => a.numero - b.numero)
  const deLaIsleta = celulas.filter((c) => c.isleta.id === isletaElegida && c.estado !== 'baja').sort((a, b) => a.numero - b.numero)
  const todasCargadas = celulas.length > 0 && !celulas.some((c) => FALTA_CARGAR.includes(c.estado))

  return (
    <>
      {lista.cargando && <Cargando filas={2} />}
      {lista.error && <MensajeError mensaje={lista.error.message} onReintentar={reintentar} />}
      {lista.celulas && (
        <div className="flex flex-col gap-4">
          {todasCargadas && (
            <p role="status" className="rounded-2xl bg-brote p-4 text-body-md text-bosque">
              Ya cargaste todas las células de este mes. Tocá una si querés editarla.
            </p>
          )}

          {isletas.length > 1 && (
            <div role="group" aria-label="Isleta" className="flex flex-wrap gap-2">
              {isletas.map((i) => {
                const elegida = i.id === isletaElegida
                return (
                  <button
                    key={i.id}
                    type="button"
                    aria-pressed={elegida}
                    onClick={() => setIsletaElegida(i.id)}
                    className={`min-h-12 rounded-full px-4 text-label-md transition duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque-hover ${
                      elegida ? 'bg-bosque font-semibold text-white' : 'bg-segmento font-medium text-texto-2 hover:text-bosque'
                    }`}
                  >
                    Isleta {i.numero}
                  </button>
                )
              })}
            </div>
          )}

          <ul aria-label="Células" className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2">
            {deLaIsleta.map((c) => {
              const falta = FALTA_CARGAR.includes(c.estado)
              const actual = c.id === celulaActualId
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => ir(c.id)}
                    aria-label={`Célula ${c.codigo}, ${falta ? 'falta cargar' : 'cargada'}${actual ? ', la actual' : ''}`}
                    aria-current={actual ? 'true' : undefined}
                    className={`flex h-12 w-full items-center justify-center gap-0.5 rounded-xl text-label-md font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque-hover ${
                      falta
                        ? 'border border-pendiente-borde bg-pendiente text-pendiente-texto'
                        : 'border border-borde bg-superficie text-texto-2'
                    } ${actual ? 'ring-[3px] ring-bosque' : ''}`}
                  >
                    {!falta && <Icono nombre="check" tamano="chip" />}
                    {c.numero}
                  </button>
                </li>
              )
            })}
          </ul>
          {!todasCargadas && <p className="text-body-sm text-texto-2">En amarillo, las que faltan cargar este mes.</p>}
        </div>
      )}
    </>
  )
}
