import imageCompression from 'browser-image-compression'
import { useEffect, useMemo, useRef, useState } from 'react'
import { guardarPlano, subirFoto } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import Icono from '../../components/Icono.jsx'
import Plano from '../../components/Plano.jsx'

// LUG-05: JPG o PNG de hasta 10 MB (el mismo tope que POST /api/fotos).
const tiposAceptados = ['image/jpeg', 'image/png']
const maximoBytes = 10 * 1024 * 1024
// El plano es una foto de dron con detalle fino: se achica menos que las fotos de las células.
const opcionesCompresion = { maxWidthOrHeight: 2000, maxSizeMB: 1, fileType: 'image/jpeg', useWebWorker: true }

// Cargar o reemplazar el plano de la isleta (LUG-05, LUG-06): elegir la imagen, ajustar las filas y
// columnas mirando la grilla encima y guardar. Las células no se mueven: el backend no guarda si
// alguna quedaría fuera de la grilla, y acá se avisa antes.
export default function EditorPlano({ isleta, onGuardado }) {
  const entrada = useRef(null)
  const [archivo, setArchivo] = useState(null)
  const [filas, setFilas] = useState(String(isleta.filas))
  const [columnas, setColumnas] = useState(String(isleta.columnas))
  const [estado, setEstado] = useState(null) // null | 'comprimiendo' | 'subiendo' | 'guardando'
  const [progreso, setProgreso] = useState(0)
  const [error, setError] = useState(null)

  // La vista previa de la imagen elegida es una URL en memoria. useMemo la crea una sola vez por
  // archivo, y el efecto la libera al elegir otra imagen o al salir de la pantalla.
  const urlLocal = useMemo(() => (archivo ? URL.createObjectURL(archivo) : null), [archivo])
  useEffect(() => {
    if (!urlLocal) return
    return () => URL.revokeObjectURL(urlLocal)
  }, [urlLocal])

  function alElegir(evento) {
    const elegido = evento.target.files?.[0]
    evento.target.value = '' // así se puede volver a elegir el mismo archivo
    if (!elegido) return
    if (!tiposAceptados.includes(elegido.type)) {
      setError('El plano tiene que ser una imagen JPG o PNG.')
      return
    }
    if (elegido.size > maximoBytes) {
      setError('La imagen pesa más de 10 MB. Elegí una más liviana.')
      return
    }
    setError(null)
    setArchivo(elegido)
  }

  // Lo que se escribió, como números. Las células necesitan la fila y la columna más altas que usan.
  const nFilas = Number(filas)
  const nColumnas = Number(columnas)
  const filaMaxima = Math.max(0, ...isleta.celulas.map((c) => c.fila))
  const columnaMaxima = Math.max(0, ...isleta.celulas.map((c) => c.columna))
  let problema = null
  if (!(nFilas >= 1 && nFilas <= 30 && nColumnas >= 1 && nColumnas <= 30)) {
    problema = 'Las filas y las columnas tienen que ser de 1 a 30.'
  } else if (filaMaxima > nFilas || columnaMaxima > nColumnas) {
    problema = `La grilla es chica: hay células hasta la fila ${filaMaxima} y la columna ${columnaMaxima}.`
  }

  const imagenUrl = urlLocal ?? (isleta.planoFotoId ? `/api/fotos/${isleta.planoFotoId}` : undefined)
  const hayCambios = Boolean(archivo) || nFilas !== isleta.filas || nColumnas !== isleta.columnas
  const necesitaImagen = !archivo && !isleta.planoFotoId

  async function guardar() {
    setError(null)
    try {
      let fotoId
      if (archivo) {
        setEstado('comprimiendo')
        const comprimida = await imageCompression(archivo, opcionesCompresion)
        setEstado('subiendo')
        setProgreso(0)
        fotoId = (await subirFoto(comprimida, setProgreso)).id
      }
      setEstado('guardando')
      await guardarPlano(isleta.id, { fotoId, filas: nFilas, columnas: nColumnas })
      onGuardado('¡Plano guardado!')
    } catch (err) {
      setError(err.message ?? 'No se pudo guardar el plano. Probá de nuevo.')
      setEstado(null)
    }
  }

  const textoCargando = { comprimiendo: 'Preparando la imagen…', subiendo: `Subiendo ${progreso} %…`, guardando: 'Guardando…' }[estado]

  return (
    <div className="flex flex-col gap-4 pt-2">
      <input ref={entrada} type="file" accept={tiposAceptados.join(',')} hidden onChange={alElegir} />
      <Boton variante="secundario" icono="photo_library" onClick={() => entrada.current.click()} disabled={Boolean(estado)} className="sm:w-auto sm:self-start">
        {imagenUrl ? 'Elegir otra imagen' : 'Elegir la imagen del plano'}
      </Boton>
      <p className="text-body-sm text-texto-3">La foto de dron de la isleta, en JPG o PNG de hasta 10 MB.</p>

      <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
        <CampoTexto etiqueta="Filas" value={filas} onChange={(e) => setFilas(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={2} className="tabular-nums" />
        <CampoTexto etiqueta="Columnas" value={columnas} onChange={(e) => setColumnas(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={2} className="tabular-nums" />
      </div>

      {problema ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-error-fondo p-3 text-body-md text-error-texto">
          <Icono nombre="error" className="shrink-0" />
          {problema}
        </p>
      ) : (
        // Vista previa: la grilla encima de la imagen, con las células donde están (LUG-05).
        <div className="flex flex-col gap-2">
          <p className="text-body-sm text-texto-3">Revisá que la grilla coincida con la foto antes de guardar.</p>
          <Plano filas={nFilas} columnas={nColumnas} celulas={isleta.celulas} imagenUrl={imagenUrl} tamanoCelda={36} />
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-error-fondo p-3 text-body-md text-error-texto">
          <Icono nombre="error" className="shrink-0" />
          {error}
        </p>
      )}

      <Boton
        icono="save"
        onClick={guardar}
        cargando={Boolean(estado)}
        textoCargando={textoCargando}
        disabled={Boolean(problema) || !hayCambios || necesitaImagen}
        className="sm:w-auto sm:self-start"
      >
        Guardar plano
      </Boton>
    </div>
  )
}
