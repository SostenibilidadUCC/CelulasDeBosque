import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { obtenerLugares } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import Cargando from '../../components/Cargando.jsx'
import MensajeError from '../../components/MensajeError.jsx'
import Modal from '../../components/Modal.jsx'
import Titulo from '../../components/Titulo.jsx'
import Vacio from '../../components/Vacio.jsx'
import { useSesion } from '../../sesion/useSesion.js'
import FormularioCelula from './FormularioCelula.jsx'

// Pantalla Nueva célula (T17, ALT-01 a ALT-06 y ALT-09). Ruta: /celulas/nueva.
// Paso 1 (acá): el lugar (fijo para el cargador, a elegir para el admin) y la isleta.
// Paso 2 (FormularioCelula): celda en el plano, número, fecha, código y confirmar.
// El lector no puede dar de alta células. El permiso real lo valida el backend.
export default function NuevaCelula() {
  const { usuario } = useSesion()
  const navigate = useNavigate()
  const esAdmin = usuario.rol === 'admin'
  const puedeCrear = esAdmin || usuario.rol === 'cargador'

  // Los lugares activos con sus isletas (GET /api/lugares): { cargando } | { error } | { lugares }.
  const [carga, setCarga] = useState({ cargando: puedeCrear })
  const [intento, setIntento] = useState(0)
  // El cargador tiene su lugar fijo; el admin lo elige.
  const [lugarId, setLugarId] = useState(esAdmin ? null : (usuario.lugar?.id ?? null))
  const [isletaId, setIsletaId] = useState(null)
  // ALT-09: si la persona ya eligió algo, cancelar pide confirmación.
  const [eligioAlgo, setEligioAlgo] = useState(false)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)

  useEffect(() => {
    if (!puedeCrear) return
    let cancelado = false
    obtenerLugares()
      .then(({ lugares }) => {
        if (cancelado) return
        setCarga({ lugares })
        // Si el lugar tiene una sola isleta, se elige sola (no cuenta como "eligió algo").
        const delCargador = lugares.find((l) => l.id === lugarId)
        if (delCargador?.isletas.length === 1) setIsletaId(delCargador.isletas[0].id)
      })
      .catch((error) => {
        if (!cancelado) setCarga({ error })
      })
    return () => {
      cancelado = true
    }
    // Solo al abrir y al reintentar: lugarId ya está fijo para el cargador y el admin lo elige después.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puedeCrear, intento])

  // Sale de la pantalla: vuelve a donde estaba, o a Cuenta si se abrió directo desde un enlace.
  function salir() {
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate('/mas', { replace: true })
  }
  function cancelar() {
    if (eligioAlgo) setConfirmarCancelar(true)
    else salir()
  }

  function elegirLugar(id) {
    setLugarId(id)
    setEligioAlgo(true)
    const lugar = carga.lugares.find((l) => l.id === id)
    setIsletaId(lugar?.isletas.length === 1 ? lugar.isletas[0].id : null)
  }
  function elegirIsleta(id) {
    setIsletaId(id)
    setEligioAlgo(true)
  }

  if (!puedeCrear) {
    return (
      <Pagina>
        <Vacio icono="lock" titulo="Esta sección es solo para administradores y cargadores" mensaje="Con tu usuario podés ver las células, pero no darlas de alta." />
      </Pagina>
    )
  }
  if (carga.cargando) {
    return (
      <Pagina>
        <Cargando filas={3} />
      </Pagina>
    )
  }
  if (carga.error) {
    return (
      <Pagina>
        <MensajeError
          mensaje={carga.error.message}
          onReintentar={() => {
            setCarga({ cargando: true })
            setIntento((n) => n + 1)
          }}
        />
      </Pagina>
    )
  }

  const lugar = carga.lugares.find((l) => l.id === lugarId) ?? null
  const isletas = [...(lugar?.isletas ?? [])].sort((a, b) => a.numero - b.numero)

  return (
    <Pagina>
      {/* ---------- Lugar ---------- */}
      <section className="flex flex-col gap-2">
        {esAdmin ? (
          <>
            <label htmlFor="nueva-celula-lugar" className="text-label-md font-medium text-texto-2">
              Lugar
            </label>
            {/* <select> nativo: en el celular abre su propio selector. 16 px para que iPhone no haga zoom. */}
            <select
              id="nueva-celula-lugar"
              value={lugarId ?? ''}
              onChange={(e) => elegirLugar(Number(e.target.value))}
              className="h-12 rounded-xl border-[1.5px] border-niebla bg-superficie px-3.5 text-body-lg text-texto focus-visible:border-bosque-hover focus-visible:ring-[3px] focus-visible:ring-hoja/25 focus-visible:outline-none sm:max-w-md"
            >
              <option value="" disabled>
                Elegí el lugar
              </option>
              {carga.lugares.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.letra} · {l.nombre}
                </option>
              ))}
            </select>
          </>
        ) : lugar ? (
          <p className="text-body-md text-texto-2">
            Lugar: <span className="font-semibold text-texto">{lugar.nombre}</span>
          </p>
        ) : (
          <Vacio icono="location_off" titulo="Tu lugar no está disponible" mensaje="Pedile al administrador que revise tu usuario." />
        )}
      </section>

      {/* ---------- Isleta ---------- */}
      {lugar && isletas.length === 0 && (
        <Vacio icono="grid_view" titulo="Este lugar todavía no tiene isletas" mensaje="El administrador las crea en Lugares e isletas." />
      )}
      {lugar && isletas.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 id="nueva-celula-isleta" className="text-label-md font-medium text-texto-2">
            Isleta
          </h2>
          <div role="group" aria-labelledby="nueva-celula-isleta" className="flex flex-wrap gap-2">
            {isletas.map((i) => {
              const elegida = i.id === isletaId
              return (
                <button
                  key={i.id}
                  type="button"
                  aria-pressed={elegida}
                  onClick={() => elegirIsleta(i.id)}
                  className={`min-h-12 min-w-12 rounded-full px-4 text-label-md transition duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque-hover ${
                    elegida ? 'bg-bosque font-semibold text-white' : 'bg-segmento font-medium text-texto-2 hover:text-bosque'
                  }`}
                >
                  Isleta {i.numero}
                  {i.nombre ? ` · ${i.nombre}` : ''}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* ---------- Plano, número, fecha y confirmar ---------- */}
      {/* key: al cambiar de isleta, el formulario arranca de cero (celda y número nuevos). */}
      {isletaId != null && <FormularioCelula key={isletaId} isletaId={isletaId} onTocar={() => setEligioAlgo(true)} />}

      {/* pb-8: el botón redondo "Cargar" de la barra de navegación sobresale y no debe taparlo. */}
      <div className="pb-8">
        <Boton variante="secundario" icono="close" onClick={cancelar}>
          Cancelar
        </Boton>
      </div>

      {/* ALT-09: confirmación antes de descartar lo elegido. */}
      <Modal abierto={confirmarCancelar} titulo="¿Descartar los datos cargados?" onCerrar={() => setConfirmarCancelar(false)}>
        <div className="flex flex-col gap-4">
          <p className="text-body-lg text-texto-2">La célula no se va a dar de alta.</p>
          {/* En celular, el primario arriba; en computadora, a la derecha (sm:order-2). Lo seguro es
              seguir cargando: por eso es el verde, y "Descartar" va en claro. */}
          <div className="grid gap-2 sm:grid-cols-2">
            <Boton className="sm:order-2" onClick={() => setConfirmarCancelar(false)}>
              Seguir cargando
            </Boton>
            <Boton variante="secundario" onClick={salir}>
              Descartar
            </Boton>
          </div>
        </div>
      </Modal>
    </Pagina>
  )
}

// Marco común de la pantalla: título y separación entre secciones.
function Pagina({ children }) {
  return (
    <div className="flex flex-col gap-6 py-4">
      <Titulo nivel="lg">Nueva célula</Titulo>
      {children}
    </div>
  )
}
