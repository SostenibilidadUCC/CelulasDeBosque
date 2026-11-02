import { porcentaje } from './avance.js'

// Barra de progreso del avance de carga. El ancho es un valor calculado, por eso va en style
// (es el único caso en que frontend/CLAUDE.md permite estilos en línea).
// role="progressbar" y los aria-value* hacen que un lector de pantalla diga el porcentaje.
// claseRiel cambia el color de la parte vacía (por ejemplo, sobre un fondo oscuro).
export default function BarraAvance({ cargadas, total, etiqueta, claseRiel = 'bg-gris-suave' }) {
  const valor = porcentaje(cargadas, total)
  return (
    <div
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={valor}
      className={`h-3 w-full overflow-hidden rounded-full ${claseRiel}`}
    >
      <div className="h-full rounded-full bg-hoja-suave" style={{ width: `${valor}%` }} />
    </div>
  )
}
