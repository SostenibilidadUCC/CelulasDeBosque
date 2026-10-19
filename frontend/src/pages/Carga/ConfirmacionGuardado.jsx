import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { obtenerSiguientePendiente } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import CodigoCelula from '../../components/CodigoCelula.jsx'
import Icono from '../../components/Icono.jsx'
import MensajeError from '../../components/MensajeError.jsx'
import Titulo from '../../components/Titulo.jsx'

// Lo que se ve después de guardar bien un registro (T14): reemplaza al formulario.
// - celula: { id, codigo, isletaId, … } de ultimo-registro.
// - actualizado: true si se editó el registro del mes, false si se creó uno nuevo.
// - onEditarDeNuevo(): vuelve a pedir los datos de la célula y arma el formulario de nuevo.
export default function ConfirmacionGuardado({ celula, actualizado, onEditarDeNuevo }) {
  const navigate = useNavigate()
  // La búsqueda de la siguiente célula: null (no se pidió), 'buscando', 'sin-pendientes' o { error }.
  const [busqueda, setBusqueda] = useState(null)

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
      const { celula: siguiente } = await obtenerSiguientePendiente(celula.id)
      if (siguiente) navigate(`/cargar/${siguiente.id}`)
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
        <div className="flex flex-col gap-3">
          <p role="status" className="flex items-start gap-2 rounded-2xl bg-brote p-4 text-body-md text-bosque">
            <Icono nombre="task_alt" tamano="chico" className="mt-0.5" />
            Ya no quedan células pendientes en esta isleta.
          </p>
          <Boton icono="flight" onClick={() => navigate(`/isletas/${celula.isletaId}`)}>
            Ver el plano de la isleta
          </Boton>
        </div>
      ) : busqueda?.error ? (
        <MensajeError mensaje={busqueda.error.message} onReintentar={irASiguiente} />
      ) : (
        <Boton
          icono="arrow_forward"
          cargando={busqueda === 'buscando'}
          textoCargando="Buscando…"
          onClick={irASiguiente}
        >
          Siguiente célula pendiente de la isleta
        </Boton>
      )}

      <div className="flex flex-col gap-3">
        <Boton variante="secundario" icono="description" onClick={() => navigate(`/celulas/${celula.id}`)}>
          Volver a la ficha
        </Boton>
        <Boton variante="texto" icono="edit_note" onClick={onEditarDeNuevo}>
          Editar de nuevo
        </Boton>
      </div>
    </div>
  )
}
