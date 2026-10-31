import { useState } from 'react'
import { useNavigate } from 'react-router'
import { obtenerCelulasDeLugar } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import Icono from '../../components/Icono.jsx'
import MensajeError from '../../components/MensajeError.jsx'
import BarraAvance from './BarraAvance.jsx'
import { nombreDelPeriodo } from './avance.js'

const numero = new Intl.NumberFormat('es-AR')

// Texto de los días que faltan para el cierre del mes.
// El vencimiento a fin de mes es la propuesta de RN-16, todavía a confirmar con la clienta.
// El número de días lo calcula el backend en hora de Córdoba.
function textoCierre(dias) {
  if (dias === 0) return 'Cierra hoy'
  if (dias === 1) return 'Cierra mañana'
  return `Cierra en ${dias} días`
}

// INI-02: avance de carga del mes del lugar del cargador, con un solo dato (lo que falta)
// y el botón que lleva directo a la próxima célula para cargar.
export default function TarjetaCargaDelMes({ lugarId, cargadas, total, periodo, diasHastaVencimiento }) {
  const navigate = useNavigate()
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState(null)

  const mes = nombreDelPeriodo(periodo).split(' ')[0] // "octubre"
  const mesConMayuscula = mes.charAt(0).toUpperCase() + mes.slice(1)
  const faltan = total - cargadas

  // Busca la primera célula pendiente del lugar (el backend las ordena por isleta y número).
  // Si no hay, busca una sin registro inicial, que también hay que cargar.
  async function seguirCargando() {
    setBuscando(true)
    setError(null)
    try {
      let { celulas } = await obtenerCelulasDeLugar(lugarId, { estado: 'pendiente' })
      if (celulas.length === 0) {
        ;({ celulas } = await obtenerCelulasDeLugar(lugarId, { estado: 'sin-registro' }))
      }
      if (celulas.length > 0) {
        navigate(`/cargar/${celulas[0].id}`)
        return
      }
      setError({ message: 'No encontramos células para cargar. Probá de nuevo en un rato.' })
    } catch (e) {
      setError(e)
    }
    setBuscando(false)
  }

  // Prueba de estilo: tarjeta en verde bosque, puntas casi rectas y el número grande en la
  // tipografía de títulos, para que sea lo primero que se ve.
  if (faltan <= 0) {
    return (
      <div className="flex items-center gap-3 rounded-sm bg-bosque p-5 text-white">
        <Icono nombre="task_alt" className="text-brote" />
        <p className="font-titulo text-headline-md font-semibold">¡Listo! Cargaste todas las células de {mes}.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 rounded-sm bg-bosque p-5 text-white">
      <p className="text-label-md font-medium tracking-wide text-brote uppercase">{mesConMayuscula}</p>
      <p className="flex items-baseline gap-3">
        <span className="font-titulo text-[56px]/none font-bold tabular-nums">{numero.format(faltan)}</span>
        <span className="text-body-lg">{faltan === 1 ? 'célula te falta cargar' : 'células te faltan cargar'}</span>
      </p>
      <BarraAvance cargadas={cargadas} total={total} etiqueta={`Avance de carga de ${mes}`} />
      <p className="text-body-md text-brote">{textoCierre(diasHastaVencimiento)}</p>
      {error ? (
        <MensajeError mensaje={error.message} onReintentar={seguirCargando} />
      ) : (
        <Boton
          variante="secundario"
          className="rounded-sm! border-0!"
          cargando={buscando}
          textoCargando="Buscando…"
          onClick={seguirCargando}
        >
          Seguir cargando
        </Boton>
      )}
    </div>
  )
}
