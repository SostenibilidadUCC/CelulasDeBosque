import { Link } from 'react-router'
import Icono from '../../components/Icono.jsx'
import BarraAvance from './BarraAvance.jsx'

const numero = new Intl.NumberFormat('es-AR')

// "1 célula" / "80 células".
function plural(cantidad, singular, pluralTexto) {
  return `${numero.format(cantidad)} ${cantidad === 1 ? singular : pluralTexto}`
}

// INI-04: tarjeta de un lugar. Toda la tarjeta es un enlace a sus células.
// esMio marca el lugar del cargador, que aparece primero.
export default function TarjetaLugar({ lugar, esMio }) {
  const { cargadas, total } = lugar.avance

  return (
    <Link
      to={`/celulas?lugar=${lugar.id}`}
      className="flex flex-col gap-3 rounded-2xl border border-borde bg-superficie p-4 shadow-nivel-1 transition duration-150 ease-out hover:border-niebla focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque-hover"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-tonal text-headline-md font-semibold text-bosque"
        >
          {lugar.letra}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-headline-sm font-semibold text-texto">
            <span className="sr-only">Lugar {lugar.letra}: </span>
            {lugar.nombre}
          </h3>
          <p className="text-body-md text-texto-2">
            {plural(lugar.cantidadCelulas, 'célula', 'células')} · {plural(lugar.cantidadIsletas, 'isleta', 'isletas')}
          </p>
        </div>
        <Icono nombre="chevron_right" className="text-texto-3" />
      </div>

      {esMio && (
        <p className="flex items-center gap-1 text-body-sm text-bosque">
          <Icono nombre="location_on" tamano="chip" />
          Tu lugar
        </p>
      )}

      <div className="flex flex-col gap-1">
        <p className="text-body-sm text-texto-3 tabular-nums">
          {numero.format(cargadas)} de {numero.format(total)} cargadas este mes
        </p>
        <BarraAvance cargadas={cargadas} total={total} etiqueta={`Avance de carga de ${lugar.nombre}`} />
      </div>
    </Link>
  )
}
