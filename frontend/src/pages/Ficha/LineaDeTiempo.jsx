import { useNavigate } from 'react-router'
import Acordeon from '../../components/Acordeon.jsx'
import Boton from '../../components/Boton.jsx'
import FotoRegistro from './FotoRegistro.jsx'
import { fechaCorta, periodoLargo } from './formato.js'

// FIC-04 y FIC-05: lista de los registros, del más nuevo al más viejo. Cada mes se abre al tocarlo
// y muestra la foto, las observaciones, quién cargó y "Editar" (solo si puedeEditar).
// Es una lista vertical (Acordeon) y no un carrusel: deslizar de costado no se descubre solo.
// Las alturas de cada mes no se repiten acá: están en las tarjetas de individuos y en el gráfico.
export default function LineaDeTiempo({ celulaId, registros }) {
  const navigate = useNavigate()

  // .toReversed() devuelve una copia dada vuelta, sin cambiar la lista original.
  const items = registros.toReversed().map((registro) => ({
    pregunta: `${periodoLargo(registro.periodo)}${registro.esInicial ? ' · Inicial' : ''}`,
    respuesta: (
      <div className="flex flex-col gap-3">
        <FotoRegistro fotoId={registro.fotoId} descripcion={`Foto del ${fechaCorta(registro.fecha)}`} className="max-w-md" />
        <p className="text-body-md text-texto-2 tabular-nums">Medido el {fechaCorta(registro.fecha)}</p>
        {registro.observaciones && <p className="text-body-md text-texto">“{registro.observaciones}”</p>}
        <p className="text-body-sm text-texto-3">
          Cargó: {registro.cargadoPor}
          {registro.modificadoPor && ` · Modificó: ${registro.modificadoPor}`}
        </p>
        {registro.puedeEditar && (
          <Boton variante="secundario" onClick={() => navigate(`/cargar/${celulaId}?registro=${registro.id}`)}>
            Editar registro
          </Boton>
        )}
      </div>
    ),
  }))

  return <Acordeon items={items} />
}
