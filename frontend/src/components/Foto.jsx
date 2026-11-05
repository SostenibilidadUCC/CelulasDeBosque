import { useEffect, useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { subirFoto } from '../api.js'
import Boton from './Boton.jsx'
import Icono from './Icono.jsx'
import PanelInferior from './PanelInferior.jsx'

// Opciones de compresión (CAR-05): lado mayor 1600 px y hasta 300 KB, siempre en JPEG.
// useWebWorker hace el trabajo en segundo plano para que la pantalla no se congele.
const opcionesCompresion = {
  maxWidthOrHeight: 1600,
  maxSizeMB: 0.3,
  fileType: 'image/jpeg',
  useWebWorker: true,
}

// Foto del registro (T13, CAR-04 y CAR-05): un solo botón que abre las opciones cámara o galería, compresión en el
// celular, subida con barra de progreso y reintentar si falla.
// - fotoId: id de la foto ya guardada (por ejemplo, al editar un registro).
// - onCambio(id): se llama con el id nuevo cuando la foto terminó de subir, y con null al elegir otra.
// - fotoAnteriorId: foto del mes anterior; si viene, se muestra al lado como referencia de encuadre.
export default function Foto({ fotoId, onCambio, fotoAnteriorId, onOcupada }) {
  // estado: 'vacia' | 'comprimiendo' | 'subiendo' | 'lista' | 'error'
  const [estadoInterno, setEstado] = useState('vacia')
  // Si la pantalla trae una foto ya guardada (aunque llegue después, al editar), se muestra como lista.
  const estado = estadoInterno === 'vacia' && fotoId ? 'lista' : estadoInterno
  const [progreso, setProgreso] = useState(0)
  const [error, setError] = useState('')
  const [vistaPrevia, setVistaPrevia] = useState(null)

  const entradaCamara = useRef(null)
  const entradaGaleria = useRef(null)
  // Guardamos la foto ya comprimida para que "Reintentar" no tenga que comprimirla de nuevo.
  const [comprimida, setComprimida] = useState(null)

  // Si la persona sale de la pantalla mientras sube, al terminar no hay que tocar el estado
  // ni avisarle a la pantalla. onCambio se guarda en un ref para llamar siempre a la versión actual.
  const montado = useRef(true)
  const alCambiar = useRef(onCambio)
  const alOcupar = useRef(onOcupada) // onOcupada(true/false) es opcional: avisa si está comprimiendo o subiendo
  useEffect(() => {
    alCambiar.current = onCambio
    alOcupar.current = onOcupada
  })
  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  // La vista previa es una URL temporal del navegador (blob:). Hay que liberarla cuando cambia
  // o cuando se cierra la pantalla; si no, queda ocupando memoria.
  useEffect(() => {
    return () => {
      if (vistaPrevia) URL.revokeObjectURL(vistaPrevia)
    }
  }, [vistaPrevia])

  const ocupada = estado === 'comprimiendo' || estado === 'subiendo'
  useEffect(() => {
    alOcupar.current?.(ocupada)
  }, [ocupada])

  async function subir(archivo) {
    setEstado('subiendo')
    setProgreso(0)
    setError('')
    try {
      const { id } = await subirFoto(archivo, setProgreso)
      if (!montado.current) return
      setEstado('lista')
      alCambiar.current?.(id)
    } catch (e) {
      if (!montado.current) return
      setEstado('error')
      setError(e.message)
    }
  }

  async function alElegir(evento) {
    const archivo = evento.target.files?.[0]
    // Se limpia el input para que se pueda volver a elegir el mismo archivo.
    evento.target.value = ''
    if (!archivo) return

    if (!archivo.type.startsWith('image/')) {
      onCambio?.(null)
      setVistaPrevia(null)
      setComprimida(null)
      setEstado('error')
      setError('El archivo no es una foto. Elegí una imagen.')
      return
    }

    // La foto anterior deja de valer: hasta que la nueva termine de subir, no hay foto para guardar.
    onCambio?.(null)
    setVistaPrevia(null)
    setEstado('comprimiendo')
    setProgreso(0)
    setError('')
    let resultado
    try {
      resultado = await imageCompression(archivo, { ...opcionesCompresion, onProgress: setProgreso })
      setComprimida(resultado)
      setVistaPrevia(URL.createObjectURL(resultado))
    } catch {
      setComprimida(null)
      setEstado('error')
      setError('No se pudo preparar la foto. Probá sacarla de nuevo.')
      return
    }
    await subir(resultado)
  }

  // Al tocar la foto (o "Cambiar foto") se abre un panel con las dos opciones: cámara o galería.
  // Así hay un solo botón en la pantalla en lugar de dos grandes.
  const [opcionesAbiertas, setOpcionesAbiertas] = useState(false)
  function elegirDesde(entrada) {
    setOpcionesAbiertas(false)
    entrada.current?.click()
  }

  // Si la foto del mes anterior no carga, no se muestra (en vez de un recuadro "no disponible").
  // Se guarda el id que falló: si llega otra foto anterior, se vuelve a intentar.
  const [anteriorFallida, setAnteriorFallida] = useState(null)
  const verAnterior = fotoAnteriorId != null && anteriorFallida !== fotoAnteriorId
  // Lo mismo con la de este mes ya guardada (al editar): si no carga, se ve el recuadro para subirla.
  const [actualFallida, setActualFallida] = useState(null)
  const fotoGuardada = fotoId != null && actualFallida !== fotoId ? fotoId : null
  const hayFoto = vistaPrevia != null || fotoGuardada != null

  return (
    <div className="flex flex-col gap-3">
      {/* Siempre en dos columnas: la foto ocupa media pantalla, no toda. Sin foto anterior, el
          recuadro va solo a la izquierda. */}
      <div className="grid grid-cols-2 gap-2">
        {verAnterior && (
          <figure className="flex flex-col gap-1">
            <img
              src={`/api/fotos/${fotoAnteriorId}`}
              alt="Foto del mes anterior"
              loading="lazy"
              onError={() => setAnteriorFallida(fotoAnteriorId)}
              className="aspect-[4/3] w-full rounded-xl bg-gris-suave object-cover"
            />
            <figcaption className="text-body-sm text-texto-2">Mes anterior</figcaption>
          </figure>
        )}
        <figure className="flex flex-col gap-1">
          {vistaPrevia ? (
            <img src={vistaPrevia} alt="Foto de este mes" className="aspect-[4/3] w-full rounded-xl bg-gris-suave object-cover" />
          ) : fotoGuardada ? (
            <img
              src={`/api/fotos/${fotoGuardada}`}
              alt="Foto de este mes"
              onError={() => setActualFallida(fotoGuardada)}
              className="aspect-[4/3] w-full rounded-xl bg-gris-suave object-cover"
            />
          ) : (
            // Sin foto: el recuadro mismo es el botón.
            <button
              type="button"
              disabled={ocupada}
              onClick={() => setOpcionesAbiertas(true)}
              className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-brote-borde bg-fondo px-3 text-center text-bosque hover:bg-tonal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icono nombre="photo_camera" className="text-bosque-hover" />
              <span className="text-label-md font-medium">{verAnterior ? 'Foto de este mes' : 'Subí la primera foto'}</span>
              <span className="text-body-sm text-texto-2">Desde arriba, con las 4 plantas</span>
            </button>
          )}
          {verAnterior && hayFoto && <figcaption className="text-body-sm text-texto-2">Este mes</figcaption>}
        </figure>
      </div>

      <EstadoSubida estado={estado} progreso={progreso} />

      {estado === 'error' && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl bg-error-fondo p-3 text-error-texto">
          <p className="flex items-center gap-2 text-body-md font-medium">
            <Icono nombre="error" />
            {error}
          </p>
          {comprimida && (
            <Boton variante="secundario" icono="refresh" onClick={() => subir(comprimida)}>
              Reintentar
            </Boton>
          )}
        </div>
      )}

      {hayFoto && (
        <Boton variante="secundario" disabled={ocupada} onClick={() => setOpcionesAbiertas(true)}>
          Cambiar foto
        </Boton>
      )}

      <PanelInferior abierto={opcionesAbiertas} titulo="Foto de la célula" onCerrar={() => setOpcionesAbiertas(false)}>
        <div className="flex flex-col gap-2">
          <Boton icono="photo_camera" onClick={() => elegirDesde(entradaCamara)}>
            Abrir cámara
          </Boton>
          <Boton variante="secundario" icono="photo_library" onClick={() => elegirDesde(entradaGaleria)}>
            Elegir de la galería
          </Boton>
        </div>
      </PanelInferior>

      {/* capture="environment" abre directo la cámara trasera en el celular. Sin capture, abre la galería. */}
      <input ref={entradaCamara} type="file" accept="image/*" capture="environment" hidden onChange={alElegir} />
      <input ref={entradaGaleria} type="file" accept="image/*" hidden onChange={alElegir} />
    </div>
  )
}

// Texto y barra de progreso mientras se prepara o se sube la foto. Color e ícono, nunca solo color.
function EstadoSubida({ estado, progreso }) {
  if (estado === 'lista') {
    return (
      <p className="flex items-center gap-2 text-body-md font-medium text-bosque">
        <Icono nombre="check_circle" relleno />
        Foto guardada
      </p>
    )
  }
  if (estado !== 'comprimiendo' && estado !== 'subiendo') return null

  const texto = estado === 'comprimiendo' ? 'Preparando la foto…' : 'Subiendo la foto…'
  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-center gap-2 text-body-md text-texto-2">
        <Icono nombre="progress_activity" className="animate-spin" />
        {texto} {progreso}%
      </p>
      <div
        role="progressbar"
        aria-label={texto}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progreso}
        className="h-2 w-full overflow-hidden rounded-full bg-gris-suave"
      >
        <div className="h-full rounded-full bg-hoja transition-[width] duration-150" style={{ width: `${progreso}%` }} />
      </div>
    </div>
  )
}
