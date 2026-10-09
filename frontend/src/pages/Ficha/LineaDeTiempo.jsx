import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import Boton from '../../components/Boton.jsx'
import Icono from '../../components/Icono.jsx'
import Tarjeta from '../../components/Tarjeta.jsx'
import FotoRegistro from './FotoRegistro.jsx'
import { fechaCorta } from './formato.js'

// FIC-04 y FIC-05: carrusel de los registros, del más viejo al más nuevo, con foto, fecha,
// alturas y quién cargó. Al tocar la foto se amplía (onAmpliar). "Editar" solo si puedeEditar.
export default function LineaDeTiempo({ celulaId, individuos, registros, onAmpliar }) {
  const navigate = useNavigate()
  const carrusel = useRef(null)

  // Arranca mostrando el último mes, que es el que más interesa.
  useEffect(() => {
    if (carrusel.current) carrusel.current.scrollLeft = carrusel.current.scrollWidth
  }, [registros])

  return (
    <div ref={carrusel} className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
      {registros.map((registro) => (
        <Tarjeta key={registro.id} className="flex w-64 shrink-0 snap-start flex-col gap-3">
          <button
            type="button"
            onClick={() => onAmpliar(registro)}
            aria-label={`Ver más grande la foto del ${fechaCorta(registro.fecha)}`}
            className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque-hover"
          >
            <FotoRegistro fotoId={registro.fotoId} descripcion={`Foto del ${fechaCorta(registro.fecha)}`} />
          </button>

          <div className="flex items-center justify-between gap-2">
            <p className="text-label-lg font-semibold text-texto tabular-nums">{fechaCorta(registro.fecha)}</p>
            {registro.esInicial && (
              <span className="rounded-full bg-tonal px-2 py-0.5 text-label-sm font-semibold text-bosque">Inicial</span>
            )}
          </div>

          <ul className="flex flex-col gap-1">
            {individuos.map((ind) => {
              const valor = registro.individuos.find((i) => i.formaDeVida === ind.formaDeVida)
              return (
                <li key={ind.formaDeVida} className="flex items-center gap-2 text-body-md text-texto-2">
                  <Icono nombre={ind.icono} tamano="chico" className="text-bosque" />
                  <span className="flex-1">{ind.nombre}</span>
                  <span className="tabular-nums">
                    {valor?.vivo ? `${valor.alturaCm} cm` : valor ? 'Muerto' : 'Sin datos'}
                  </span>
                </li>
              )
            })}
          </ul>

          {registro.observaciones && <p className="text-body-sm text-texto-2">“{registro.observaciones}”</p>}

          <p className="text-body-sm text-texto-3">
            Cargó: {registro.cargadoPor}
            {registro.modificadoPor && (
              <>
                <br />
                Modificó: {registro.modificadoPor}
              </>
            )}
          </p>

          {registro.puedeEditar && (
            // La carga en modo edición es el T14 de Cande: ella define cómo lee ?registro=.
            <Boton variante="secundario" icono="edit" onClick={() => navigate(`/cargar/${celulaId}?registro=${registro.id}`)} className="mt-auto">
              Editar
            </Boton>
          )}
        </Tarjeta>
      ))}
    </div>
  )
}