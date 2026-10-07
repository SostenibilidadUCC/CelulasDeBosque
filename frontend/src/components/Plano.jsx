// Grilla del plano de una isleta (T12). Recibe todo por props para que la puedan reutilizar
// Nueva célula (T17) y Lugares e isletas (T20).
//
// Props:
//   filas, columnas     tamaño de la grilla
//   celulas             [{ id, numero, codigo, fila, columna, estado }]
//   tamanoCelda         lado de cada celda en px (36 como mínimo, frontend/CLAUDE.md)
//   resaltadaId         id de la célula a resaltar (por ejemplo, la que se buscó)
//   onSeleccionar       (celula) => void, al tocar una célula
//   onSeleccionarLibre  (fila, columna) => void, opcional: si está, las celdas libres se pueden tocar
//   imagenUrl           opcional: foto de dron de fondo
//   mostrarLeyenda      true por defecto

// Colores de cada celda según el estado del mes. Son más fuertes que los chips para verse de lejos.
const estilosCelda = {
  'al-dia': 'bg-bosque-hover text-white',
  'fuera-de-termino': 'bg-bosque-hover text-white ring-2 ring-inset ring-pendiente-borde',
  pendiente: 'bg-pendiente-celda text-pendiente-texto',
  'sin-registro': 'border border-gris-borde bg-gris-suave text-texto-2',
  baja: 'border border-gris-borde bg-gris-suave text-texto-3 line-through',
}
// Mientras el backend no mande el estado del mes, la célula se ve neutra.
const estiloSinEstado = 'border border-niebla bg-superficie text-texto'

const textosEstado = {
  'al-dia': 'Al día',
  'fuera-de-termino': 'Fuera de término',
  pendiente: 'Pendiente',
  'sin-registro': 'Sin registro inicial',
  baja: 'Dada de baja',
}

const leyenda = ['al-dia', 'pendiente', 'sin-registro', 'baja']

export default function Plano({
  filas,
  columnas,
  celulas,
  tamanoCelda = 40,
  resaltadaId,
  onSeleccionar,
  onSeleccionarLibre,
  imagenUrl,
  mostrarLeyenda = true,
}) {
  // Para encontrar rápido qué célula hay en cada posición: "fila-columna" → célula.
  const porPosicion = new Map(celulas.map((c) => [`${c.fila}-${c.columna}`, c]))
  const hayEstados = celulas.some((c) => c.estado && c.estado !== 'baja')

  const celdas = []
  for (let fila = 1; fila <= filas; fila++) {
    for (let columna = 1; columna <= columnas; columna++) {
      const celula = porPosicion.get(`${fila}-${columna}`)

      if (!celula) {
        celdas.push(
          onSeleccionarLibre ? (
            <button
              key={`${fila}-${columna}`}
              type="button"
              onClick={() => onSeleccionarLibre(fila, columna)}
              aria-label={`Celda libre, fila ${fila}, columna ${columna}`}
              className="rounded-md border border-dashed border-gris-borde bg-superficie/60 focus-visible:outline-2 focus-visible:outline-bosque-hover"
            />
          ) : (
            <div key={`${fila}-${columna}`} aria-hidden="true" className="rounded-md bg-borde/60" />
          ),
        )
        continue
      }

      const resaltada = celula.id === resaltadaId
      const estado = textosEstado[celula.estado]
      celdas.push(
        <button
          key={celula.id}
          type="button"
          data-celula={celula.id}
          onClick={() => onSeleccionar?.(celula)}
          aria-label={`Célula ${celula.codigo}${estado ? `, ${estado}` : ''}`}
          aria-current={resaltada ? 'true' : undefined}
          className={`flex items-center justify-center rounded-md text-label-sm font-semibold tabular-nums transition duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque-hover ${
            estilosCelda[celula.estado] ?? estiloSinEstado
          } ${resaltada ? 'relative z-10 scale-110 shadow-nivel-2 ring-[3px] ring-white outline-2 outline-offset-[3px] outline-bosque' : ''}`}
        >
          {celula.numero}
        </button>,
      )
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {mostrarLeyenda && hayEstados && (
        <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Referencias del plano">
          {leyenda.map((e) => (
            <li key={e} className="flex items-center gap-2 text-body-sm text-texto-2">
              <span aria-hidden="true" className={`size-4 rounded ${estilosCelda[e]}`} />
              {textosEstado[e]}
            </li>
          ))}
          <li className="flex items-center gap-2 text-body-sm text-texto-2">
            <span aria-hidden="true" className="size-4 rounded bg-borde/60" />
            Sin célula
          </li>
        </ul>
      )}

      {/* overflow-auto: si la grilla no entra en la pantalla, se desplaza con el dedo. */}
      <div className="overflow-auto rounded-2xl border border-borde bg-tonal p-3 shadow-nivel-1">
        <div className="relative w-max">
          {imagenUrl && (
            <img src={imagenUrl} alt="Foto aérea de la isleta" className="absolute inset-0 size-full rounded-xl object-cover" />
          )}
          {/* El tamaño de la grilla depende de cada isleta: por eso va en style (es un valor calculado). */}
          <div
            className="relative grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${columnas}, ${tamanoCelda}px)`,
              gridAutoRows: `${tamanoCelda}px`,
            }}
          >
            {celdas}
          </div>
        </div>
      </div>
    </div>
  )
}