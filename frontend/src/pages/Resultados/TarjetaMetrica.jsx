import Icono from '../../components/Icono.jsx'
import Tarjeta from '../../components/Tarjeta.jsx'

// RES-02: una métrica grande (frontend/CLAUDE.md, Tarjetas de métricas): nombre arriba, ícono en un
// círculo tonal, número grande y una línea de contexto abajo. Si valor es null, muestra "—".
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
      <p className="text-headline-lg font-bold text-bosque tabular-nums md:text-headline-xl">{texto}</p>
      <p className="text-body-sm text-texto-2">{contexto}</p>
    </Tarjeta>
  )
}
