import { useNavigate } from 'react-router'
import Boton from '../../components/Boton.jsx'
import Icono from '../../components/Icono.jsx'
import Buscador from './Buscador.jsx'
import Selector from './Selector.jsx'

// Estados del mes para el filtro, con los mismos textos e íconos que ChipEstado.
// Solo los 3 que se usan en la carga mensual; los demás estados se siguen viendo en cada tarjeta.
const opcionesEstado = [
  { valor: '', texto: 'Todas', icono: 'select_all' },
  { valor: 'pendiente', texto: 'Pendiente', icono: 'schedule' },
  { valor: 'al-dia', texto: 'Al día', icono: 'check_circle' },
]

// EXP-01 y EXP-02: selector de lugar, filtros por isleta y estado, y buscador.
// No guarda nada: cada cambio se avisa con onCambiar({ ... }) y Celulas.jsx lo pasa a la URL.
// mostrarEstado: el filtro de estado solo sirve a quien carga en este lugar.
export default function Filtros({ lugares, lugar, isleta, estado, q, mostrarEstado, onCambiar }) {
  const navigate = useNavigate()
  const opcionesLugar = lugares.map((l) => ({ valor: String(l.id), texto: `${l.letra} · ${l.nombre}` }))
  const opcionesIsleta = [
    { valor: '', texto: 'Todas las isletas' },
    ...lugar.isletas.map((i) => ({ valor: String(i.id), texto: `Isleta ${i.numero}${i.nombre ? ` · ${i.nombre}` : ''}` })),
  ]

  // La isleta del botón "Ver plano": la elegida, o la única del lugar.
  const isletaDelPlano =
    lugar.isletas.length === 1 ? lugar.isletas[0] : lugar.isletas.find((i) => String(i.id) === isleta)

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* El selector de lugar solo aparece si hay más de uno: si no, es un control que no sirve.
            Al cambiar de lugar se borran la isleta y la búsqueda: son de otro lugar. */}
        {lugares.length > 1 && (
          <Selector
            etiqueta="Lugar"
            valor={String(lugar.id)}
            onChange={(valor) => onCambiar({ lugar: valor, isleta: '', q: '' })}
            opciones={opcionesLugar}
          />
        )}
        {/* La isleta y, al lado, "Ver plano" de la isleta que se está mirando. Si el lugar tiene una
            sola isleta, el selector no aparece y queda solo el botón. Con "Todas las isletas" no hay
            un plano que mostrar, así que el botón aparece cuando se elige una. */}
        {(lugar.isletas.length > 1 || isletaDelPlano) && (
          <div className="flex items-end gap-2">
            {lugar.isletas.length > 1 && (
              <div className="min-w-0 flex-1">
                <Selector etiqueta="Isleta" valor={isleta} onChange={(valor) => onCambiar({ isleta: valor })} opciones={opcionesIsleta} />
              </div>
            )}
            {isletaDelPlano && (
              <Boton
                variante="secundario"
                className="w-auto shrink-0"
                aria-label={`Ver plano de la isleta ${isletaDelPlano.numero}`}
                onClick={() => navigate(`/isletas/${isletaDelPlano.id}`)}
              >
                Ver plano
              </Boton>
            )}
          </div>
        )}
      </div>

      <Buscador inicial={q} onBuscar={(texto) => onCambiar({ q: texto })} />

      {/* Estado del mes como control segmentado (frontend/CLAUDE.md): una sola barra con 3 partes
          iguales que ocupa todo el ancho, así entra sin desplazarse de costado.
          aria-pressed dice cuál está elegida. */}
      {mostrarEstado && (
        <div role="group" aria-label="Estado del mes" className="grid grid-cols-3 gap-1 rounded-full bg-segmento p-1">
          {opcionesEstado.map((o) => {
            const elegido = estado === o.valor
            return (
              <button
                key={o.valor}
                type="button"
                aria-pressed={elegido}
                onClick={() => onCambiar({ estado: o.valor })}
                className={`flex min-h-12 items-center justify-center gap-1.5 rounded-full px-2 text-label-md whitespace-nowrap transition duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque-hover ${
                  elegido ? 'bg-superficie font-semibold text-bosque shadow-nivel-1' : 'font-medium text-texto-2 hover:text-bosque'
                }`}
              >
                <Icono nombre={o.icono} tamano="chico" relleno={elegido} />
                {o.texto}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
