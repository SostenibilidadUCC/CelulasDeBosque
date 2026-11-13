import { Link } from 'react-router'
import Boton from '../../components/Boton.jsx'
import Icono from '../../components/Icono.jsx'
import Tarjeta from '../../components/Tarjeta.jsx'

const nombresDeTipo = { universidad: 'Universidad', colegio: 'Colegio' }

// Tarjeta de un lugar en Lugares e isletas: sus datos, si está visible y sus isletas.
export default function TarjetaLugar({ lugar, onEditar, onAgregarIsleta, onEditarIsleta }) {
  const detalle = [nombresDeTipo[lugar.tipo] ?? lugar.tipo, lugar.localidad].filter(Boolean).join(' · ')

  return (
    <Tarjeta className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-tonal font-titulo text-headline-md font-semibold text-bosque"
        >
          {lugar.letra}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-headline-sm font-semibold text-texto">
            <span className="sr-only">Lugar {lugar.letra}: </span>
            {lugar.nombre}
          </h2>
          <p className="text-body-md text-texto-2">{detalle}</p>
          {/* Estado con color, ícono y texto (nunca solo color). */}
          {lugar.activo ? (
            <p className="flex items-center gap-1 text-body-sm text-bosque-hover">
              <Icono nombre="visibility" tamano="chip" />
              Visible para todos
            </p>
          ) : (
            <p className="flex items-center gap-1 text-body-sm text-texto-3">
              <Icono nombre="visibility_off" tamano="chip" />
              Deshabilitado: no aparece en los listados ni en las métricas
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-label-md font-medium text-texto-2">Isletas</h3>
        {lugar.isletas.length === 0 ? (
          <p className="text-body-md text-texto-2">Todavía no tiene isletas.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lugar.isletas.map((isleta) => (
              <li key={isleta.id} className="flex items-center gap-2 rounded-xl border border-borde p-2 pl-3">
                <Link
                  to={`/lugares/isletas/${isleta.id}`}
                  className="flex min-h-12 min-w-0 flex-1 flex-col justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-bosque-hover"
                >
                  <span className="text-label-lg font-medium text-bosque">
                    Isleta {isleta.numero}
                    {isleta.nombre && <span className="font-normal text-texto-2"> · {isleta.nombre}</span>}
                  </span>
                  <span className="text-body-sm text-texto-3 tabular-nums">
                    {isleta.cantidadCelulas} {isleta.cantidadCelulas === 1 ? 'célula' : 'células'} ·{' '}
                    {isleta.planoFotoId ? `Plano de ${isleta.filas} × ${isleta.columnas}` : 'Sin plano'}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => onEditarIsleta(isleta)}
                  aria-label={`Editar la isleta ${isleta.numero}`}
                  className="flex size-12 shrink-0 items-center justify-center rounded-xl text-bosque hover:bg-tonal focus-visible:ring-[3px] focus-visible:ring-hoja/40 focus-visible:outline-none"
                >
                  <Icono nombre="edit" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Boton variante="secundario" icono="edit" onClick={onEditar}>
          Editar lugar
        </Boton>
        <Boton variante="tonal" icono="add" onClick={onAgregarIsleta}>
          Agregar isleta
        </Boton>
      </div>
    </Tarjeta>
  )
}
