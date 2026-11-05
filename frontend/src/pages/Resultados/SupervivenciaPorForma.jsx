import Icono from '../../components/Icono.jsx'
import Tarjeta from '../../components/Tarjeta.jsx'

// RES-03: una barra por forma de vida con su tasa de supervivencia. Son barras hechas con divs
// (no hace falta Recharts): el ancho de la barra es el porcentaje.
// Todas las barras van en el mismo color (hoja, el de las barras de progreso): el nombre y el
// ícono ya dicen qué forma de vida es.
export default function SupervivenciaPorForma({ datos }) {
  return (
    <Tarjeta className="flex flex-col gap-4">
      {datos.map((forma) => (
        <div key={forma.formaDeVida} className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Icono nombre={forma.icono} tamano="chico" className="text-bosque" />
            <span className="flex-1 text-label-lg font-semibold text-texto">{forma.nombre}</span>
            <span className="text-label-lg font-semibold text-bosque tabular-nums">
              {forma.tasa == null ? '—' : `${forma.tasa.toLocaleString('es-AR')} %`}
            </span>
          </div>
          {/* La barra empieza en 0 y llega a 100 (frontend/CLAUDE.md, Gráficos). El ancho es un valor
              calculado, por eso va en style. */}
          <div className="h-3 w-full overflow-hidden rounded-full bg-gris-suave" aria-hidden="true">
            <div className="h-full rounded-full bg-hoja" style={{ width: `${forma.tasa ?? 0}%` }} />
          </div>
        </div>
      ))}
    </Tarjeta>
  )
}
