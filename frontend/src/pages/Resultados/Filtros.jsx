import Icono from '../../components/Icono.jsx'
import Selector from '../Celulas/Selector.jsx'
import { opcionesPeriodo } from './periodos.js'

// RES-01: lugar (todos o uno), isleta (solo si hay un lugar elegido), período y forma de vida.
// Lugar, isleta y período usan el Selector de la pantalla Células (Cande, T11). La forma de vida
// es un control segmentado (frontend/CLAUDE.md, "Control segmentado de formas de vida").
// filtros tiene los valores como texto ('' = todos), igual que los <select>.
// onCambiar recibe solo lo que cambió: { lugar: '2' }.
export default function Filtros({ filtros, lugares, formasDeVida, onCambiar }) {
  const lugarElegido = lugares.find((l) => String(l.id) === filtros.lugar)

  const opcionesLugar = [
    { valor: '', texto: 'Todos los lugares' },
    ...lugares.map((l) => ({ valor: String(l.id), texto: `${l.letra} · ${l.nombre}` })),
  ]
  const opcionesIsleta = [
    { valor: '', texto: 'Todas las isletas' },
    ...(lugarElegido?.isletas ?? []).map((i) => ({ valor: String(i.id), texto: `Isleta ${i.numero}` })),
  ]
  const opcionesForma = [
    { valor: '', texto: 'Todas', icono: null },
    ...formasDeVida.map((f) => ({ valor: String(f.formaDeVida), texto: f.nombre, icono: f.icono })),
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* En el celular, uno debajo del otro (los textos son largos y se cortarían);
          en la computadora, los 3 desplegables en una fila. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Selector etiqueta="Lugar" valor={filtros.lugar} onChange={(valor) => onCambiar({ lugar: valor })} opciones={opcionesLugar} />
        <Selector etiqueta="Período" valor={filtros.periodo} onChange={(valor) => onCambiar({ periodo: valor })} opciones={opcionesPeriodo} />
        {lugarElegido && (
          <Selector etiqueta="Isleta" valor={filtros.isleta} onChange={(valor) => onCambiar({ isleta: valor })} opciones={opcionesIsleta} />
        )}
      </div>

      {/* flex-wrap: si no entran en una fila del celular, las opciones bajan a la siguiente. */}
      <div className="flex w-fit flex-wrap gap-1 rounded-3xl bg-segmento p-1" role="group" aria-label="Forma de vida">
        {opcionesForma.map((opcion) => {
          const elegida = filtros.forma === opcion.valor
          return (
            <button
              key={opcion.valor}
              type="button"
              aria-pressed={elegida}
              onClick={() => onCambiar({ forma: opcion.valor })}
              className={`flex min-h-10 items-center gap-1 rounded-full px-3 text-label-md transition duration-150 ease-out focus-visible:outline-2 focus-visible:outline-bosque-hover ${
                elegida ? 'bg-superficie font-semibold text-bosque shadow-nivel-1' : 'text-texto-2'
              }`}
            >
              {opcion.icono && <Icono nombre={opcion.icono} tamano="chico" />}
              {opcion.texto}
            </button>
          )
        })}
      </div>
    </div>
  )
}
