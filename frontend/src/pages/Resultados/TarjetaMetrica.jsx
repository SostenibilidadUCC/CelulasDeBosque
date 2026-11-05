import Icono from '../../components/Icono.jsx'
import Tarjeta from '../../components/Tarjeta.jsx'
import { NumberTicker } from '../../components/ui/number-ticker.jsx'

// RES-02: una métrica grande (frontend/CLAUDE.md, Tarjetas de métricas): nombre arriba, ícono en un
// círculo tonal, número grande y una línea de contexto abajo. Si valor es null, muestra "—".
// El número cuenta hacia arriba una sola vez al entrar (NumberTicker de Magic UI, igual que en el
// Inicio) y queda quieto si el teléfono pide menos movimiento.
export default function TarjetaMetrica({ icono, nombre, valor, unidad, contexto }) {
  // toLocaleString('es-AR') escribe los decimales con coma: 88.9 → "88,9".
  const texto = valor == null ? '—' : `${valor.toLocaleString('es-AR')}${unidad ? ` ${unidad}` : ''}`

  return (
    <Tarjeta className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-tonal text-bosque">
          <Icono nombre={icono} tamano="chico" />
        </span>
        <p className="text-label-md font-medium text-texto-2">{nombre}</p>
      </div>
      <p className="font-titulo whitespace-nowrap text-headline-lg font-bold text-bosque tabular-nums md:text-headline-xl">
        {valor == null ? (
          '—'
        ) : (
          <>
            {/* El lector de pantalla lee el valor final, no la animación. */}
            <span className="sr-only">{texto}</span>
            <span aria-hidden="true">
              <NumberTicker value={valor} decimalPlaces={Number.isInteger(valor) ? 0 : 1} />
              {unidad && ` ${unidad}`}
            </span>
          </>
        )}
      </p>
      <p className="text-body-sm text-texto-2">{contexto}</p>
    </Tarjeta>
  )
}
