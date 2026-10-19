import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { obtenerUltimoRegistro } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import Cargando from '../../components/Cargando.jsx'
import CodigoCelula from '../../components/CodigoCelula.jsx'
import Icono from '../../components/Icono.jsx'
import MensajeError from '../../components/MensajeError.jsx'
import Titulo from '../../components/Titulo.jsx'
import Vacio from '../../components/Vacio.jsx'
import { useSesion } from '../../sesion/useSesion.js'
import EncabezadoCarga from './EncabezadoCarga.jsx'
import { hoyEnCordoba, periodoDeFecha, rangoDeFechas, validarFecha } from './fechas.js'
import { puedeCargarEnLugar } from './permisos.js'

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
  const { celula, periodoActual, actual } = datos

  // "hoy" se calcula una sola vez al abrir la pantalla.
  const [hoy] = useState(hoyEnCordoba)
  // Si ya hay registro de este mes, se edita: la fecha arranca en la guardada. Si no, en hoy.
  const [fecha, setFecha] = useState(actual?.fecha ?? hoy)
  // TODO T14 paso 3: estado de los 4 individuos, precargado desde datos.anterior (RN-09).
  // TODO T14 paso 4: estado de la foto (fotoId) y las observaciones.

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

      {/* TODO T14 paso 3: reemplazar este recuadro por los 4 bloques de individuos. */}
      <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-niebla bg-superficie px-4 py-8 text-center">
        <Icono nombre="park" tamano="grande" className="text-placeholder" />
        <p className="text-body-md text-texto-2">Acá van los 4 individuos (paso 3).</p>
      </div>

      {/* TODO T14 paso 4: foto y observaciones. */}
      {/* TODO T14 paso 5: botón "Guardar registro" (deshabilitado si hay errorFecha). */}
    </Pagina>
  )
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
