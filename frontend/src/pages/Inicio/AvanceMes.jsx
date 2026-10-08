import Icono from '../../components/Icono.jsx'
import Tarjeta from '../../components/Tarjeta.jsx'
import BarraAvance from './BarraAvance.jsx'
import { nombreDelPeriodo, porcentaje } from './avance.js'

const numero = new Intl.NumberFormat('es-AR')

// Texto de los días que faltan para el vencimiento.
// El vencimiento a fin de mes es la propuesta de RN-16, todavía a confirmar con la clienta
// (pregunta 11). El número de días lo calcula el backend en hora de Córdoba.
function textoVencimiento(dias, mes) {
  if (dias === 0) return `La carga de ${mes} vence hoy`
  if (dias === 1) return `Falta 1 día para el cierre de ${mes}`
  return `Faltan ${dias} días para el cierre de ${mes}`
}

// INI-02: avance de carga del mes (células con registro del período sobre células activas).
// Para el admin llega la suma de todos los lugares; para el cargador, solo su lugar.
export default function AvanceMes({ cargadas, total, periodo, diasHastaVencimiento, lugar }) {
  const mes = nombreDelPeriodo(periodo) // "octubre 2026"
  const soloMes = mes.split(' ')[0] // "octubre"

  return (
    <Tarjeta className="flex flex-col gap-3">
      <p className="text-label-md font-medium text-texto-2">
        Avance de {mes}
        {lugar ? ` · ${lugar}` : ' · todos los lugares'}
      </p>
      <p className="flex items-baseline gap-2 text-texto">
        <span className="text-headline-lg font-semibold text-bosque tabular-nums">{porcentaje(cargadas, total)} %</span>
        <span className="text-body-md text-texto-2 tabular-nums">
          {numero.format(cargadas)} de {numero.format(total)} células cargadas
        </span>
      </p>
      <BarraAvance cargadas={cargadas} total={total} etiqueta={`Avance de carga de ${mes}`} />
      <p className="flex items-center gap-1 text-body-sm text-texto-3">
        <Icono nombre="calendar_month" tamano="chip" />
        {textoVencimiento(diasHastaVencimiento, soloMes)}
      </p>
    </Tarjeta>
  )
}
