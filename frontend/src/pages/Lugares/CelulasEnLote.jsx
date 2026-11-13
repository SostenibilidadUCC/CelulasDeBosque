import { useState } from 'react'
import { crearCelulasEnLote } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import Icono from '../../components/Icono.jsx'
import Plano from '../../components/Plano.jsx'
import { hoyEnCordoba } from '../Carga/fechas.js'
import { celulasConLote, resumenDelLote, siguienteNumeroCelula } from './lote.js'

// Crear células en lote (LUG-07): número inicial y final, fecha de plantación, vista previa en el
// plano y recién ahí confirmar. El backend las ubica en las celdas libres, de izquierda a derecha y
// de arriba abajo, y crea los 4 individuos de cada una (RN-01).
export default function CelulasEnLote({ isleta, onGuardado }) {
  const [datos, setDatos] = useState({ desde: String(siguienteNumeroCelula(isleta.celulas)), hasta: '', fecha: hoyEnCordoba() })
  const [vistaPrevia, setVistaPrevia] = useState(null) // las células que se van a crear, o null
  const [estado, setEstado] = useState(null) // null | 'calculando' | 'creando'
  const [error, setError] = useState(null)

  // Cambiar cualquier dato descarta la vista previa: hay que volver a verla antes de crear.
  const cambiar = (campo, limpiar = (v) => v) => (e) => {
    setDatos((anteriores) => ({ ...anteriores, [campo]: limpiar(e.target.value) }))
    setVistaPrevia(null)
  }
  const soloDigitos = (v) => v.replace(/\D/g, '')
  const pedido = { desde: Number(datos.desde), hasta: Number(datos.hasta), fechaPlantacion: datos.fecha }

  async function verVistaPrevia(evento) {
    evento.preventDefault()
    setEstado('calculando')
    setError(null)
    try {
      const respuesta = await crearCelulasEnLote(isleta.id, pedido, true)
      setVistaPrevia(respuesta.celulas)
    } catch (err) {
      setError(err.message)
    } finally {
      setEstado(null)
    }
  }

  async function crear() {
    setEstado('creando')
    setError(null)
    try {
      const respuesta = await crearCelulasEnLote(isleta.id, pedido)
      onGuardado(`¡Listo! Se crearon ${resumenDelLote(respuesta.celulas)}.`)
    } catch (err) {
      setError(err.message)
      setEstado(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <form onSubmit={verVistaPrevia} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
          <CampoTexto etiqueta="Desde el número" value={datos.desde} onChange={cambiar('desde', soloDigitos)} inputMode="numeric" maxLength={4} required className="tabular-nums" />
          <CampoTexto etiqueta="Hasta el número" value={datos.hasta} onChange={cambiar('hasta', soloDigitos)} inputMode="numeric" maxLength={4} required className="tabular-nums" />
        </div>
        <div className="sm:max-w-xs">
          <CampoTexto etiqueta="Fecha de plantación" type="date" value={datos.fecha} max={hoyEnCordoba()} onChange={cambiar('fecha')} required />
        </div>
        <Boton type="submit" variante="secundario" icono="visibility" cargando={estado === 'calculando'} textoCargando="Calculando…" disabled={Boolean(estado)} className="sm:w-auto sm:self-start">
          Ver dónde van
        </Boton>
      </form>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-error-fondo p-3 text-body-md text-error-texto">
          <Icono nombre="error" className="shrink-0" />
          {error}
        </p>
      )}

      {vistaPrevia && (
        <div className="flex flex-col gap-3">
          <p className="flex items-start gap-2 rounded-xl bg-tonal p-3 text-body-md text-bosque">
            <Icono nombre="info" className="shrink-0" />
            Se van a crear {resumenDelLote(vistaPrevia)}. Las nuevas son las celdas blancas con número.
          </p>
          <Plano
            filas={isleta.filas}
            columnas={isleta.columnas}
            celulas={celulasConLote(isleta.celulas, vistaPrevia)}
            imagenUrl={isleta.planoFotoId ? `/api/fotos/${isleta.planoFotoId}` : undefined}
            tamanoCelda={36}
          />
          <Boton icono="add" onClick={crear} cargando={estado === 'creando'} textoCargando="Creando…" className="sm:w-auto sm:self-start">
            Crear {vistaPrevia.length} {vistaPrevia.length === 1 ? 'célula' : 'células'}
          </Boton>
        </div>
      )}
    </div>
  )
}
