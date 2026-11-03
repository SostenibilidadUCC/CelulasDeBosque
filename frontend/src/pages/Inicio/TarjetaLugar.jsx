import { Link } from 'react-router'
import Icono from '../../components/Icono.jsx'
import { MagicCard } from '../../components/ui/magic-card.jsx'

const numero = new Intl.NumberFormat('es-AR')

// INI-04: tarjeta de un lugar. Toda la tarjeta es un enlace a sus células.
// esMio marca el lugar del cargador con "Tu lugar".
// No muestra el avance de carga: ver los lugares uno al lado del otro se leería como un ranking.
export default function TarjetaLugar({ lugar, esMio = false }) {
  const celulas = `${numero.format(lugar.cantidadCelulas)} ${lugar.cantidadCelulas === 1 ? 'célula' : 'células'}`

  // MagicCard (Magic UI): en computadora, una luz verde suave sigue al mouse y el borde se tiñe.
  // En el celular no hay mouse, así que se ve como una tarjeta normal.
  // El foco va hacia adentro (outline-offset negativo) porque la tarjeta recorta lo que sobresale.
  return (
    <MagicCard
      className="rounded-2xl shadow-nivel-1"
      gradientSize={220}
      gradientColor="var(--color-tonal)"
      gradientOpacity={1}
      gradientFrom="var(--color-hoja)"
      gradientTo="var(--color-bosque-hover)"
    >
    <Link
      to={`/celulas?lugar=${lugar.id}`}
      className="flex min-h-[88px] items-center gap-4 rounded-2xl p-4 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-bosque-hover"
    >
      {/* La letra del lugar en un círculo: es como lo identifica el equipo (A = Campus UCC). */}
      <span
        aria-hidden="true"
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-tonal font-titulo text-headline-md font-bold text-bosque"
      >
        {lugar.letra}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="truncate text-headline-sm font-semibold text-texto">
          <span className="sr-only">Lugar {lugar.letra}: </span>
          {lugar.nombre}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body-md text-texto-2">{celulas}</span>
          {esMio && (
            <span className="inline-flex h-7 items-center gap-1 rounded-full border border-brote-borde bg-brote px-3 text-label-sm text-bosque">
              <Icono nombre="person_pin_circle" className="text-[16px]" />
              Tu lugar
            </span>
          )}
        </div>
      </div>
      <Icono nombre="chevron_right" className="text-texto-3" />
    </Link>
    </MagicCard>
  )
}
