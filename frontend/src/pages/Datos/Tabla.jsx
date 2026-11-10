import { Link } from 'react-router'
import ChipEstado from '../../components/ChipEstado.jsx'
import Icono from '../../components/Icono.jsx'
import { periodoLargo } from '../Ficha/formato.js'
import { fechaTabla, numero, siNo, SIN_DATO } from './formato.js'

// Columnas de la tabla (TAB-01), en el orden de la sección 11.1 de la v6. El código va aparte
// porque es la columna fija. orden es la clave que entiende el backend (?orden=); sin orden,
// la columna no se puede ordenar. derecha: números alineados a la derecha.
const columnas = [
  { titulo: 'Lugar', orden: 'lugar', celda: (f) => f.lugar },
  { titulo: 'Forma de vida', orden: 'forma', celda: (f) => f.nombreForma },
  { titulo: 'Período', orden: 'periodo', celda: (f) => periodoLargo(f.periodo) },
  { titulo: 'Fecha de medición', orden: 'fecha', celda: (f) => fechaTabla(f.fechaMedicion) },
  { titulo: 'Inicial', celda: (f) => siNo(f.esInicial) },
  { titulo: 'Fuera de término', celda: (f) => siNo(f.fueraDeTermino) },
  {
    titulo: 'Estado',
    orden: 'estado',
    celda: (f) => (f.vivo == null ? SIN_DATO : <ChipEstado estado={f.vivo ? 'vivo' : 'muerto'} />),
  },
  { titulo: 'Altura (cm)', orden: 'altura', derecha: true, celda: (f) => numero(f.alturaCm) },
  { titulo: 'Flores', orden: 'flores', derecha: true, celda: (f) => numero(f.flores) },
  { titulo: 'Frutos', orden: 'frutos', celda: (f) => siNo(f.frutos) },
  { titulo: 'Plántulas nuevas', orden: 'plantulas', celda: (f) => siNo(f.plantulas) },
  // Cobertura: vacía hasta que se responda la pregunta 8 de la v6 (RN-19).
  { titulo: 'Cobertura (%)', derecha: true, celda: (f) => numero(f.coberturaPct) },
  { titulo: 'Observaciones', ancha: true, celda: (f) => f.observaciones || SIN_DATO },
  { titulo: 'Cargado por', orden: 'cargadoPor', celda: (f) => f.cargadoPor },
]

const claseCelda = 'border-b border-borde px-3 py-2 align-middle'

// TAB-01 y TAB-04: la tabla con el código fijo a la izquierda. En el celular se desplaza de costado
// dentro de su recuadro (overflow-x-auto), sin desarmar la página.
// orden y dir son los actuales; onOrdenar(clave) los cambia.
export default function Tabla({ filas, orden, dir, onOrdenar }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-borde bg-superficie shadow-nivel-1">
      <table className="w-full border-separate border-spacing-0 text-body-sm tabular-nums">
        <thead>
          <tr>
            {/* sticky left-0: la columna queda quieta al desplazar la tabla; el fondo tapa lo que pasa por debajo. */}
            <Encabezado
              titulo="Código"
              clave="codigo"
              orden={orden}
              dir={dir}
              onOrdenar={onOrdenar}
              className="sticky left-0 z-10 border-r"
            />
            {columnas.map((c) => (
              <Encabezado key={c.titulo} titulo={c.titulo} clave={c.orden} orden={orden} dir={dir} onOrdenar={onOrdenar} derecha={c.derecha} />
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={`${f.codigoIndividuo}-${f.periodo}`} className="group">
              <th scope="row" className={`${claseCelda} sticky left-0 z-10 border-r bg-superficie text-left group-hover:bg-tonal`}>
                {/* Lleva a la ficha de la célula, donde están las fotos y los gráficos. */}
                <Link
                  to={`/celulas/${f.celulaId}`}
                  className="inline-flex min-h-10 items-center rounded-full bg-tonal px-2.5 text-code-tag font-semibold tracking-[0.06em] whitespace-nowrap text-bosque underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-bosque-hover"
                >
                  {f.codigoIndividuo}
                </Link>
              </th>
              {columnas.map((c) => (
                <td
                  key={c.titulo}
                  className={`${claseCelda} text-texto group-hover:bg-tonal ${c.derecha ? 'text-right' : ''} ${
                    c.ancha ? 'min-w-56' : 'whitespace-nowrap'
                  }`}
                >
                  {c.celda(f)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Título de columna. Si se puede ordenar, es un botón: el primer toque ordena de menor a mayor
// y el segundo, al revés. aria-sort le dice al lector de pantalla cómo está ordenada.
function Encabezado({ titulo, clave, orden, dir, onOrdenar, derecha = false, className = '' }) {
  const activa = clave && clave === orden
  const clases = `border-b border-borde bg-gris-suave px-3 py-2 text-label-sm font-semibold whitespace-nowrap text-texto-2 ${
    derecha ? 'text-right' : 'text-left'
  } ${className}`

  if (!clave) {
    return (
      <th scope="col" className={clases}>
        {titulo}
      </th>
    )
  }
  return (
    <th scope="col" className={clases} aria-sort={activa ? (dir === 'desc' ? 'descending' : 'ascending') : 'none'}>
      <button
        type="button"
        onClick={() => onOrdenar(clave)}
        className={`inline-flex min-h-10 items-center gap-1 rounded-md focus-visible:outline-2 focus-visible:outline-bosque-hover ${
          activa ? 'text-bosque' : ''
        }`}
      >
        {titulo}
        <Icono
          nombre={activa ? (dir === 'desc' ? 'arrow_downward' : 'arrow_upward') : 'unfold_more'}
          tamano="chip"
          className={activa ? '' : 'text-placeholder'}
        />
      </button>
    </th>
  )
}
