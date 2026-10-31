import { Link } from 'react-router'
import Icono from '../../components/Icono.jsx'

const numero = new Intl.NumberFormat('es-AR')

// INI-04: tarjeta de un lugar. Toda la tarjeta es un enlace a sus células.
// esMio marca el lugar del cargador, que aparece primero.
// No muestra el avance de carga: ver los lugares uno al lado del otro se leería como un ranking.
export default function TarjetaLugar({ lugar, esMio }) {
  const celulas = `${numero.format(lugar.cantidadCelulas)} ${lugar.cantidadCelulas === 1 ? 'célula' : 'células'}`

  return (
    <Link
      to={`/celulas?lugar=${lugar.id}`}
      className="flex items-center gap-3 rounded-sm border border-borde border-l-4 border-l-hoja bg-superficie p-4 transition duration-150 ease-out hover:border-niebla hover:border-l-bosque focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque-hover"
    >
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-headline-sm font-semibold text-texto">
          <span className="sr-only">Lugar {lugar.letra}: </span>
          {lugar.nombre}
        </h3>
        <p className="text-body-md text-texto-2">
          {celulas}
          {esMio && ' · Tu lugar'}
        </p>
      </div>
      <Icono nombre="chevron_right" className="text-texto-3" />
    </Link>
  )
}
