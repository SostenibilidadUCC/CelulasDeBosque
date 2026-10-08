import Buscador from './Buscador.jsx'
import Selector from './Selector.jsx'

// Estados del mes para el filtro, con los mismos textos que ChipEstado.
const opcionesEstado = [
  { valor: '', texto: 'Todos los estados' },
  { valor: 'al-dia', texto: 'Al día' },
  { valor: 'pendiente', texto: 'Pendiente' },
  { valor: 'sin-registro', texto: 'Sin registro inicial' },
  { valor: 'fuera-de-termino', texto: 'Fuera de término' },
  { valor: 'baja', texto: 'Dada de baja' },
]

// EXP-01 y EXP-02: selector de lugar, filtros por isleta y estado, y buscador.
// No guarda nada: cada cambio se avisa con onCambiar({ ... }) y Celulas.jsx lo pasa a la URL.
export default function Filtros({ lugares, lugar, isleta, estado, q, onCambiar }) {
  const opcionesLugar = lugares.map((l) => ({ valor: String(l.id), texto: `${l.letra} · ${l.nombre}` }))
  const opcionesIsleta = [
    { valor: '', texto: 'Todas las isletas' },
    ...lugar.isletas.map((i) => ({ valor: String(i.id), texto: `Isleta ${i.numero}${i.nombre ? ` · ${i.nombre}` : ''}` })),
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* Al cambiar de lugar se borran la isleta y la búsqueda: son de otro lugar. */}
      <Selector
        etiqueta="Lugar"
        valor={String(lugar.id)}
        onChange={(valor) => onCambiar({ lugar: valor, isleta: '', q: '' })}
        opciones={opcionesLugar}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Selector etiqueta="Isleta" valor={isleta} onChange={(valor) => onCambiar({ isleta: valor })} opciones={opcionesIsleta} />
        <Selector etiqueta="Estado del mes" valor={estado} onChange={(valor) => onCambiar({ estado: valor })} opciones={opcionesEstado} />
      </div>
      <Buscador key={q} inicial={q} onBuscar={(texto) => onCambiar({ q: texto })} />
    </div>
  )
}
