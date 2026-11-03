import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import Boton from '../../components/Boton.jsx'
import CodigoCelula from '../../components/CodigoCelula.jsx'
import Icono from '../../components/Icono.jsx'
import MensajeError from '../../components/MensajeError.jsx'
import Titulo from '../../components/Titulo.jsx'

// Lo que se ve después de guardar bien un registro (T14), solo cuando no se pudo pasar sola a la
// próxima célula (Carga.jsx lo hace después de cada guardado):
// - sinPendientes true: no queda ninguna célula por cargar este mes en el lugar.
// - sinPendientes false: falló la búsqueda de la próxima; se ofrece buscarla de nuevo.
// Otras props:
// - celula: { id, codigo, … } de ultimo-registro.
// - actualizado: true si se editó el registro del mes, false si se creó uno nuevo.
// - onBuscarSiguiente(): devuelve el id de la próxima célula para cargar, o null si no hay.
// - onEditarDeNuevo(): vuelve a pedir los datos de la célula y arma el formulario de nuevo.
export default function ConfirmacionGuardado({ celula, actualizado, sinPendientes, onBuscarSiguiente, onEditarDeNuevo }) {
  const navigate = useNavigate()
  // La búsqueda de la siguiente célula: null (no se pidió), 'buscando', 'sin-pendientes' o { error }.
  const [busqueda, setBusqueda] = useState(sinPendientes ? 'sin-pendientes' : null)

  // Al aparecer: la vista vuelve arriba y el foco va al título, así quien usa lector de pantalla
  // escucha que se guardó (el formulario, donde estaba el foco, ya no existe).
  const titulo = useRef(null)
  useEffect(() => {
    window.scrollTo({ top: 0 })
    titulo.current?.focus()
  }, [])

  async function irASiguiente() {
    setBusqueda('buscando')
    try {
      const siguienteId = await onBuscarSiguiente()
      if (siguienteId != null) navigate(`/cargar/${siguienteId}`)
      else setBusqueda('sin-pendientes')
    } catch (error) {
      setBusqueda({ error })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div ref={titulo} tabIndex={-1} className="flex flex-col items-center gap-2 rounded-2xl pt-6 text-center">
        <Icono nombre="check_circle" tamano="grande" relleno className="text-bosque-hover" />
        <Titulo nivel="lg">{actualizado ? 'Registro actualizado' : 'Registro guardado'}</Titulo>
        <CodigoCelula codigo={celula.codigo} className="text-label-lg" />
      </div>

      {busqueda === 'sin-pendientes' ? (
        <>
          <p role="status" className="rounded-2xl bg-brote p-4 text-center text-body-md text-bosque">
            No quedan células por cargar este mes.
          </p>
          <Boton onClick={() => navigate('/inicio')}>Volver al inicio</Boton>
        </>
      ) : busqueda?.error ? (
        <MensajeError mensaje={busqueda.error.message} onReintentar={irASiguiente} />
      ) : (
        <Boton cargando={busqueda === 'buscando'} textoCargando="Buscando…" onClick={irASiguiente}>
          Ir a la próxima célula
        </Boton>
      )}

      <Boton variante="texto" onClick={onEditarDeNuevo}>
        Editar de nuevo
      </Boton>
    </div>
  )
}
