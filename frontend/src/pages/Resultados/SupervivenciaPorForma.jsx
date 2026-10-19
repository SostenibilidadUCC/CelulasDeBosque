import Icono from '../../components/Icono.jsx'
import Tarjeta from '../../components/Tarjeta.jsx'
import { colorDeForma } from '../Ficha/formato.js'

// RES-03: por qué importa cada forma de vida, por número (así no cambia cuando Herbácea pase a
// Gramínea en el T28). TODO: revisar los textos con la clienta.
const porQueImporta = {
  1: 'Da sombra y estructura: con los años forma el techo del bosque.',
  2: 'Ocupa el estrato medio y da refugio y alimento a aves e insectos.',
  3: 'Cubre el suelo rápido y ayuda a que no se erosione.',
  4: 'Tapiza el suelo, conserva la humedad y frena las malezas.',
}

// RES-03: una barra por forma de vida con su tasa de supervivencia. Son barras hechas con divs
// (no hace falta Recharts): el ancho de la barra es el porcentaje.
export default function SupervivenciaPorForma({ datos }) {
  return (
    <Tarjeta className="flex flex-col gap-4">
      {datos.map((forma) => (
        <div key={forma.formaDeVida} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Icono nombre={forma.icono} tamano="chico" className="text-bosque" />
            <span className="flex-1 text-label-lg font-semibold text-texto">{forma.nombre}</span>
            <span className="text-label-lg font-semibold text-bosque tabular-nums">
              {forma.tasa == null ? '—' : `${forma.tasa.toLocaleString('es-AR')} %`}
            </span>
          </div>
          {/* La barra empieza en 0 y llega a 100 (frontend/CLAUDE.md, Gráficos). El ancho y el color
              son valores calculados, por eso van en style. */}
          <div className="h-3 w-full overflow-hidden rounded-full bg-gris-suave" aria-hidden="true">
            <div
              className="h-full rounded-full"
              style={{ width: `${forma.tasa ?? 0}%`, backgroundColor: colorDeForma[forma.formaDeVida] }}
            />
          </div>
          <p className="text-body-sm text-texto-2">
            {porQueImporta[forma.formaDeVida]} ({forma.individuos} individuos)
          </p>
        </div>
      ))}
    </Tarjeta>
  )
}
