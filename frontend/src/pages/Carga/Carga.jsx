import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { crearRegistro, modificarRegistro, obtenerUltimoRegistro } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import Cargando from '../../components/Cargando.jsx'
import CodigoCelula from '../../components/CodigoCelula.jsx'
import Foto from '../../components/Foto.jsx'
import Icono from '../../components/Icono.jsx'
import MensajeError from '../../components/MensajeError.jsx'
import Modal from '../../components/Modal.jsx'
import Titulo from '../../components/Titulo.jsx'
import Vacio from '../../components/Vacio.jsx'
import BloqueIndividuo from './BloqueIndividuo.jsx'
import CampoObservaciones from './CampoObservaciones.jsx'
import ConfirmacionGuardado from './ConfirmacionGuardado.jsx'
import EncabezadoCarga from './EncabezadoCarga.jsx'
import { mensajeDeGuardado } from './errores.js'
import { hoyEnCordoba, mesEnMinuscula, periodoDeFecha, rangoDeFechas, validarFecha } from './fechas.js'
import { alturaAnterior, estabaMuerto, individuoMuerto, individuoNuevo, individuosIniciales } from './individuos.js'
import { armarPedido } from './pedido.js'
import { alturasSinCambio, errorDeFoto, errorDeIndividuo, esFormularioValido } from './validacion.js'

// Pantalla de carga mensual (T14). Ruta: /cargar/:celulaId.
// Fecha, foto, los 4 individuos, observaciones y el guardado, todo dentro de FormularioCarga.
export default function Carga() {
  const { celulaId } = useParams()

  // /cargar sin célula (el botón "Carga mensual" de Inicio lleva acá).
  if (!celulaId) return <SinCelula />

  // key={celulaId}: si se pasa a otra célula, la pantalla arranca de cero (datos y fecha nuevos).
  return <CargaDeCelula key={celulaId} celulaId={celulaId} />
}

// Pide los datos de la célula y decide qué mostrar: cargando, error, no existe,
// sin permiso, dada de baja o el formulario.
function CargaDeCelula({ celulaId }) {
  const navigate = useNavigate()

  const [carga, setCarga] = useState({ cargando: true })
  const [intento, setIntento] = useState(0) // al cambiarlo, el useEffect vuelve a pedir los datos

  useEffect(() => {
    // "cancelado" evita guardar la respuesta si el usuario ya salió de la pantalla.
    let cancelado = false
    obtenerUltimoRegistro(celulaId)
      .then((datos) => {
        if (!cancelado) setCarga({ datos })
      })
      .catch((error) => {
        if (!cancelado) setCarga({ error })
      })
    return () => {
      cancelado = true
    }
  }, [celulaId, intento])

  function reintentar() {
    setCarga({ cargando: true })
    setIntento((n) => n + 1)
  }

  if (carga.cargando) {
    return (
      <Pagina>
        <Cargando filas={3} />
      </Pagina>
    )
  }

  // 404 (no existe) y 400 (el id de la URL no es un número) se muestran igual.
  if (carga.error?.estado === 404 || carga.error?.estado === 400) {
    return (
      <Pagina>
        <Vacio icono="search_off" titulo="No existe esa célula" mensaje="Revisá el enlace o elegí otra célula.">
          <Boton variante="secundario" icono="grid_view" onClick={() => navigate('/celulas')}>
            Ir a Células
          </Boton>
        </Vacio>
      </Pagina>
    )
  }

  if (carga.error) {
    return (
      <Pagina>
        <MensajeError mensaje={carga.error.message} onReintentar={reintentar} />
      </Pagina>
    )
  }

  const { celula, puedeEditar } = carga.datos
  const volverALaFicha = () => navigate(`/celulas/${celula.id}`)

  // EXP-04: solo lectura. puedeEditar lo calcula el backend con auth.PuedeEditarLugar (igual que
  // Células e Isleta). Ocultar la carga es solo experiencia de uso: el backend también valida al guardar.
  if (!puedeEditar) {
    return (
      <Pagina>
        <div className="flex flex-wrap items-center gap-2">
          <CodigoCelula codigo={celula.codigo} className="text-label-lg" />
          <span className="text-body-md text-texto-2">
            {celula.lugar} · Isleta {celula.isleta}
          </span>
        </div>
        <p className="flex items-start gap-2 rounded-2xl bg-tonal p-4 text-body-md text-bosque">
          <Icono nombre="visibility" tamano="chico" className="mt-0.5" />
          Tenés acceso de solo lectura en este lugar: podés ver la célula, pero no cargar registros.
        </p>
        <Boton variante="secundario" icono="arrow_back" onClick={volverALaFicha}>
          Volver a la ficha
        </Boton>
      </Pagina>
    )
  }

  // RN-14: una célula dada de baja no recibe registros.
  if (celula.dadaDeBaja) {
    return (
      <Pagina>
        <Vacio
          icono="block"
          titulo={`La célula ${celula.codigo} está dada de baja`}
          mensaje="No se pueden cargar registros en una célula dada de baja."
        >
          <Boton variante="secundario" icono="arrow_back" onClick={volverALaFicha}>
            Volver a la ficha
          </Boton>
        </Vacio>
      </Pagina>
    )
  }

  // onRecargar vuelve a pedir los datos: el formulario se desmonta y se arma de nuevo con lo guardado.
  return <FormularioCarga datos={carga.datos} onRecargar={reintentar} />
}

// El formulario de carga. Se monta recién cuando llegaron los datos, así el estado inicial
// (la fecha) puede salir de la respuesta sin un useEffect.
// Acá vive todo el estado del registro: fecha, foto, individuos, observaciones y el guardado.
function FormularioCarga({ datos, onRecargar }) {
  const { celula, formasDeVida, periodoActual, actual, anterior } = datos

  // "hoy" se calcula una sola vez al abrir la pantalla.
  const [hoy] = useState(hoyEnCordoba)
  // Si ya hay registro de este mes, se edita: la fecha arranca en la guardada. Si no, en hoy.
  const [fecha, setFecha] = useState(actual?.fecha ?? hoy)
  // Los 4 individuos, en el orden de formasDeVida. Ver individuosIniciales para la precarga (RN-09).
  // Con una función, useState la corre solo la primera vez (no en cada render).
  const [individuos, setIndividuos] = useState(() => individuosIniciales(datos))
  // CAR-13: un solo texto del registro. Editando, el guardado; nuevo, vacío (no se copia el del mes anterior).
  const [observaciones, setObservaciones] = useState(actual?.observaciones ?? '')
  // La confirmación abierta: { tipo: 'muerto' | 'reposicion', formaDeVida }, o null si no hay ninguna.
  const [confirmacion, setConfirmacion] = useState(null)
  // RN-07: el id de la foto de este mes. Editando, la guardada; nuevo, null (nunca la del mes anterior).
  const [fotoId, setFotoId] = useState(actual?.fotoId ?? null)
  // Mientras Foto comprime o sube, fotoId es null: con esto no se muestra "Falta la foto" en ese
  // momento y no se deja guardar hasta que termine (Foto lo avisa con onOcupada).
  const [fotoOcupada, setFotoOcupada] = useState(false)
  // Recién después del primer intento de guardar se muestran los errores de foto e individuos
  // (el de la fecha se muestra al momento).
  const [mostrarErrores, setMostrarErrores] = useState(false)
  const errorFoto = errorDeFoto(fotoId)

  // ---------- Guardado ----------
  const [guardando, setGuardando] = useState(false) // para el botón ("Guardando…")
  // Para cortar un segundo envío en el acto. "guardando" es estado de React y se actualiza recién en
  // el próximo render: dos toques muy seguidos lo verían todavía en false. Un ref cambia al instante.
  const enviando = useRef(false)
  const [errorGuardado, setErrorGuardado] = useState(null) // { texto, verRegistroDelMes } o null
  const [confirmarSinCambio, setConfirmarSinCambio] = useState(null) // formas de vida con la altura igual, o null
  const [guardado, setGuardado] = useState(false) // true cuando el backend respondió bien
  // Cada vez que falla la validación se suma 1: el useEffect de abajo lleva la vista al primer error.
  const [pedidoDeFoco, setPedidoDeFoco] = useState(0)
  const formulario = useRef(null)

  useEffect(() => {
    if (pedidoDeFoco === 0) return
    // Corre después del render, cuando los errores ya están en pantalla. Se busca el primero en el
    // orden de la página: un campo marcado (aria-invalid) o un bloque con error (data-error).
    const primero = formulario.current?.querySelector('[aria-invalid="true"], [data-error="true"]')
    if (!primero) return
    primero.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // El foco va al campo mismo, o al primer control del bloque (el desplegable de altura, o
    // Vivo/Muerto si falta elegir, o el botón de la cámara si falta la foto). Los <input hidden> de
    // Foto (cámara y galería) no se pueden enfocar, por eso se saltean.
    const controles = 'select, textarea, input:not([hidden])'
    const campo = primero.matches(controles)
      ? primero
      : (primero.querySelector(controles) ?? primero.querySelector('button:not([disabled])'))
    campo?.focus({ preventScroll: true })
  }, [pedidoDeFoco])

  // Reemplaza el individuo de esa forma de vida por otro (los demás quedan igual).
  function reemplazarIndividuo(formaDeVida, nuevo) {
    setIndividuos((lista) => lista.map((ind) => (ind.formaDeVida === formaDeVida ? nuevo : ind)))
  }
  // Cambia uno o más datos del individuo (por ejemplo { alturaCm: 120 }).
  function cambiarIndividuo(formaDeVida, cambios) {
    setIndividuos((lista) => lista.map((ind) => (ind.formaDeVida === formaDeVida ? { ...ind, ...cambios } : ind)))
  }
  // Vivo con los valores iniciales: altura del mes anterior (si hay), 0 flores, sin frutos ni plántulas.
  function revivir(formaDeVida) {
    reemplazarIndividuo(formaDeVida, individuoNuevo(formaDeVida, alturaAnterior(anterior, formaDeVida)))
  }
  function confirmar() {
    const { tipo, formaDeVida } = confirmacion
    if (tipo === 'muerto') reemplazarIndividuo(formaDeVida, individuoMuerto(formaDeVida))
    else revivir(formaDeVida) // reposición: en la base sigue siendo el mismo individuo
    setConfirmacion(null)
  }
  const cerrarConfirmacion = () => setConfirmacion(null)

  // RN-06: qué fechas se pueden elegir y si la elegida está bien.
  const reglasFecha = { fechaPlantacion: celula.fechaPlantacion, registroEditado: actual, hoy }
  const { min, max } = rangoDeFechas(reglasFecha)
  const errorFecha = validarFecha(fecha, reglasFecha)

  // El período sale de la fecha elegida. Si la fecha está vacía (se borró), se muestra el del registro
  // editado o el del mes en curso.
  const periodo = fecha ? periodoDeFecha(fecha) : (actual?.periodo ?? periodoActual)

  // OJO: "editando" se decide con el registro del MES EN CURSO (datos.actual). Si en un registro nuevo
  // se elige una fecha de un mes anterior, el período del encabezado cambia, pero este aviso no:
  // si ese mes ya tenía registro, lo resuelve el paso de guardar (el backend responde 409 con el
  // registroId y el front abre la edición, RN-04).
  const editando = actual != null
  const formularioValido = esFormularioValido({ errorFecha, fotoId, individuos, observaciones })

  // Al tocar Guardar: valida y, si las alturas quedaron igual que el mes anterior, pide confirmarlo (CAR-08).
  function intentarGuardar() {
    if (enviando.current) return // ya hay un guardado en curso
    setMostrarErrores(true)
    setErrorGuardado(null)
    if (!formularioValido) {
      setPedidoDeFoco((n) => n + 1)
      return
    }
    const sinCambio = alturasSinCambio(individuos, anterior)
    if (sinCambio.length > 0) {
      setConfirmarSinCambio(sinCambio)
      return
    }
    guardar()
  }

  // Manda el registro. Si falla, no se toca nada de lo cargado: solo se muestra el error.
  async function guardar() {
    if (enviando.current) return // corta un segundo envío aunque el botón todavía no se haya deshabilitado
    enviando.current = true
    setConfirmarSinCambio(null)
    setGuardando(true)
    setErrorGuardado(null)
    const pedido = armarPedido({ fecha, fotoId, observaciones, individuos })
    try {
      if (editando) await modificarRegistro(actual.id, pedido)
      else await crearRegistro(celula.id, pedido)
      setGuardado(true)
    } catch (error) {
      // TODO T17: un 401 (sesión vencida) manda al login y lo cargado se pierde: falta el borrador.
      setErrorGuardado(mensajeDeGuardado(error, { fechaEsDelMesActual: periodo === periodoActual }))
    } finally {
      enviando.current = false
      setGuardando(false)
    }
  }

  if (guardado) {
    return (
      <Pagina>
        <ConfirmacionGuardado celula={celula} actualizado={editando} onEditarDeNuevo={onRecargar} />
      </Pagina>
    )
  }

  return (
    <Pagina refContenedor={formulario}>
      <EncabezadoCarga celula={celula} periodo={periodo} periodoActual={periodoActual} editando={editando} />

      {mostrarErrores && !formularioValido && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl bg-error-fondo p-4 text-body-md font-medium text-error-texto">
          <Icono nombre="error" tamano="chico" />
          Revisá los campos marcados.
        </p>
      )}


      <CampoTexto
        etiqueta="Fecha de medición"
        type="date"
        value={fecha}
        min={min}
        max={max}
        onChange={(evento) => setFecha(evento.target.value)}
        error={errorFecha}
      />

      {/* RN-07: la foto es obligatoria. Foto (components/) se encarga de comprimir, subir y reintentar;
          acá solo se guarda el id que devuelve. La del mes anterior se muestra al lado como referencia
          de encuadre, pero nunca se usa como la de este mes. */}
      <section className="flex flex-col gap-3" data-error={mostrarErrores && errorFoto && !fotoOcupada ? 'true' : undefined}>
        <Titulo nivel="sm" como="h2">
          Foto de la célula
        </Titulo>
        <Foto
          fotoId={fotoId}
          onCambio={setFotoId}
          onOcupada={setFotoOcupada}
          fotoAnteriorId={anterior?.fotoId ?? undefined}
        />
        {mostrarErrores && errorFoto && !fotoOcupada && (
          <p role="alert" className="flex items-center gap-1 text-body-sm text-error">
            <Icono nombre="error" tamano="chip" />
            {errorFoto}
          </p>
        )}
      </section>

      {/* Los 4 bloques, en el orden de formasDeVida (1 a 4). 16 px entre bloques. */}
      <div className="flex flex-col gap-4">
        {formasDeVida.map((forma, i) => {
          const individuo = individuos[i]
          const { formaDeVida } = forma
          // CAR-07: la altura del registro anterior, o null si no hay (sin anterior, muerto o reposición).
          const alturaPrevia = alturaAnterior(anterior, formaDeVida)
          const referencia = alturaPrevia != null ? { periodo: anterior.periodo, alturaCm: alturaPrevia } : null
          return (
            <BloqueIndividuo
              key={formaDeVida}
              forma={forma}
              individuo={individuo}
              estabaMuerto={estabaMuerto(anterior, formaDeVida)}
              referencia={referencia}
              error={mostrarErrores ? errorDeIndividuo(individuo) : null}
              onCambiar={(cambios) => cambiarIndividuo(formaDeVida, cambios)}
              onElegirVivo={() => revivir(formaDeVida)}
              onPedirMuerto={() => setConfirmacion({ tipo: 'muerto', formaDeVida })}
              onPedirReposicion={() => setConfirmacion({ tipo: 'reposicion', formaDeVida })}
            />
          )
        })}
      </div>

      <CampoObservaciones valor={observaciones} onChange={setObservaciones} />

      {/* Error del guardado. Lo cargado sigue en pantalla para corregir o reintentar. */}
      {errorGuardado && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl bg-error-fondo p-4 text-error-texto">
          <p className="flex items-start gap-2 text-body-md font-medium">
            <Icono nombre="error" tamano="chico" className="mt-0.5" />
            {errorGuardado.texto}
          </p>
          {errorGuardado.verRegistroDelMes && (
            <Boton variante="secundario" icono="history" onClick={onRecargar}>
              Ver lo guardado (se descarta lo que cargaste ahora)
            </Boton>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Boton
          icono="save"
          cargando={guardando}
          disabled={fotoOcupada}
          onClick={intentarGuardar}
        >
          {editando ? 'Guardar cambios' : `Guardar registro de ${mesEnMinuscula(periodo)}`}
        </Boton>
        {fotoOcupada && (
          <p role="status" className="flex items-center gap-2 text-body-md text-texto-2">
            <Icono nombre="hourglass_top" tamano="chico" />
            Esperá a que termine de subir la foto.
          </p>
        )}
      </div>

      {/* CAR-08: confirmación si alguna altura quedó igual que el mes anterior. No es un error. */}
      <Modal
        abierto={confirmarSinCambio != null}
        titulo="La altura quedó igual que el mes anterior, ¿es correcto?"
        onCerrar={() => setConfirmarSinCambio(null)}
      >
        {confirmarSinCambio && (
          <div className="flex flex-col gap-4">
            <p className="text-body-lg text-texto-2">
              Sin cambios en: {confirmarSinCambio.map((forma) => nombreDeForma(formasDeVida, forma)).join(', ')}.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Boton onClick={guardar}>Sí, es correcto</Boton>
              <Boton variante="secundario" onClick={() => setConfirmarSinCambio(null)}>
                Revisar
              </Boton>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        abierto={confirmacion != null}
        titulo={confirmacion?.tipo === 'reposicion' ? '¿Se repuso este individuo?' : '¿Marcar como muerto?'}
        onCerrar={cerrarConfirmacion}
      >
        {confirmacion && (
          <div className="flex flex-col gap-4">
            <p className="text-body-lg text-texto-2">
              {nombreDeForma(formasDeVida, confirmacion.formaDeVida)}:{' '}
              {confirmacion.tipo === 'reposicion'
                ? 'se empieza a cargar uno nuevo.'
                : 'no se carga nada más para este individuo.'}
            </p>
            {/* En celular, el primario arriba; en computadora, a la derecha. */}
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Boton onClick={confirmar}>
                {confirmacion.tipo === 'reposicion' ? 'Cargar uno nuevo' : 'Marcar como muerto'}
              </Boton>
              <Boton variante="secundario" onClick={cerrarConfirmacion}>
                Cancelar
              </Boton>
            </div>
          </div>
        )}
      </Modal>
    </Pagina>
  )
}

// El nombre de una forma de vida, del catálogo que manda el backend (nunca escrito a mano).
function nombreDeForma(formasDeVida, formaDeVida) {
  return formasDeVida.find((f) => f.formaDeVida === formaDeVida)?.nombre ?? ''
}

// /cargar sin célula: se elige la célula desde Células.
function SinCelula() {
  const navigate = useNavigate()
  return (
    <Pagina>
      <Titulo nivel="lg">Carga mensual</Titulo>
      <Vacio
        icono="grid_view"
        titulo="Elegí una célula para cargar"
        mensaje="Buscala en Células y tocá «Cargar registro del mes»."
      >
        <Boton variante="secundario" icono="grid_view" onClick={() => navigate('/celulas')}>
          Ir a Células
        </Boton>
      </Vacio>
    </Pagina>
  )
}

// Marco común de la pantalla: separación entre bloques.
// refContenedor (opcional) deja buscar adentro, por ejemplo el primer campo con error.
function Pagina({ children, refContenedor }) {
  return (
    <div ref={refContenedor} className="flex flex-col gap-6 py-4">
      {children}
    </div>
  )
}
