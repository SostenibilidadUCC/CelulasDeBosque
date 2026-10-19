import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { obtenerUltimoRegistro } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import Cargando from '../../components/Cargando.jsx'
import CodigoCelula from '../../components/CodigoCelula.jsx'
import Icono from '../../components/Icono.jsx'
import MensajeError from '../../components/MensajeError.jsx'
import Modal from '../../components/Modal.jsx'
import Titulo from '../../components/Titulo.jsx'
import Vacio from '../../components/Vacio.jsx'
import { useSesion } from '../../sesion/useSesion.js'
import BloqueIndividuo from './BloqueIndividuo.jsx'
import CampoObservaciones from './CampoObservaciones.jsx'
import EncabezadoCarga from './EncabezadoCarga.jsx'
import { hoyEnCordoba, periodoDeFecha, rangoDeFechas, validarFecha } from './fechas.js'
import { alturaAnterior, estabaMuerto, individuoMuerto, individuoNuevo, individuosIniciales } from './individuos.js'
import { puedeCargarEnLugar } from './permisos.js'
import { errorDeIndividuo } from './validacion.js'

// Pantalla de carga mensual (T14). Ruta: /cargar/:celulaId.
// Paso 2: encabezado y fecha de medición. Los pasos siguientes suman los 4 individuos,
// la foto y el guardado dentro de FormularioCarga (ver los TODO de abajo).
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
  const { usuario } = useSesion() // RutaPrivada ya garantiza que hay usuario
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

  const { celula } = carga.datos
  const volverALaFicha = () => navigate(`/celulas/${celula.id}`)

  // EXP-04: solo lectura. Ocultar la carga es solo experiencia de uso: el backend también lo valida.
  if (!puedeCargarEnLugar(usuario, celula.lugarId)) {
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

  return <FormularioCarga datos={carga.datos} />
}

// El formulario de carga. Se monta recién cuando llegaron los datos, así el estado inicial
// (la fecha) puede salir de la respuesta sin un useEffect.
// Acá vive todo el estado del registro: los pasos siguientes (individuos, foto y guardado)
// lo leen y lo cambian desde acá.
function FormularioCarga({ datos }) {
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
  // TODO T14 paso 4: estado de la foto (fotoId).

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

  return (
    <Pagina>
      <EncabezadoCarga celula={celula} periodo={periodo} periodoActual={periodoActual} editando={editando} />

      <CampoTexto
        etiqueta="Fecha de medición"
        type="date"
        value={fecha}
        min={min}
        max={max}
        onChange={(evento) => setFecha(evento.target.value)}
        error={errorFecha}
      />

      {/* TODO T14 paso 4: la foto va acá, arriba de los individuos. */}

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
              error={errorDeIndividuo(individuo)}
              onCambiar={(cambios) => cambiarIndividuo(formaDeVida, cambios)}
              onElegirVivo={() => revivir(formaDeVida)}
              onPedirMuerto={() => setConfirmacion({ tipo: 'muerto', formaDeVida })}
              onPedirReposicion={() => setConfirmacion({ tipo: 'reposicion', formaDeVida })}
            />
          )
        })}
      </div>

      <CampoObservaciones valor={observaciones} onChange={setObservaciones} />

      {/* TODO T14 paso 5: botón "Guardar registro", habilitado solo si
          esFormularioValido({ errorFecha, individuos, observaciones }) (validacion.js).
          Las observaciones se mandan con observacionesParaGuardar (vacío o espacios → null).
          CAR-08: antes de guardar, si alturasSinCambio(individuos, anterior) no está vacía, pedir
          confirmación ("La altura quedó igual que el mes anterior en: …"). No es un error. */}

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
function Pagina({ children }) {
  return <div className="flex flex-col gap-6 py-4">{children}</div>
}
