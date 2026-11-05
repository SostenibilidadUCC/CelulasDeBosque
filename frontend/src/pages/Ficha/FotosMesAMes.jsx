import { useState } from 'react'
import Titulo from '../../components/Titulo.jsx'
import FotoRegistro from './FotoRegistro.jsx'
import { fechaCorta, periodoLargo } from './formato.js'

// FIC-07 (versión simple): todas las fotos de la célula, mes por mes y una al lado de la otra,
// de la más vieja a la más nueva, para ver cómo creció. Al tocar una se ve más grande (onAmpliar).
// Las fotos que no cargan se ocultan (igual que en FotoRegistro). Si no queda ninguna, no se muestra
// la sección (ni su título).
// registros: del más viejo al más nuevo.
export default function FotosMesAMes({ registros, codigo, onAmpliar }) {
  const [fallidas, setFallidas] = useState([]) // ids de fotos que no cargaron

  const conFoto = registros.filter((r) => r.fotoId != null && !fallidas.includes(r.fotoId))
  if (conFoto.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <Titulo nivel="md">Fotos mes por mes</Titulo>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {conFoto.map((registro) => (
        <li key={registro.id}>
          <figure className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => onAmpliar(registro)}
              aria-label={`Ver más grande la foto de ${periodoLargo(registro.periodo)}`}
              className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque-hover"
            >
              <FotoRegistro
                fotoId={registro.fotoId}
                descripcion={`Foto de la célula ${codigo}, ${fechaCorta(registro.fecha)}`}
                onFallo={() => setFallidas((ids) => [...ids, registro.fotoId])}
              />
            </button>
            <figcaption className="text-label-md font-semibold text-texto">{periodoLargo(registro.periodo)}</figcaption>
          </figure>
        </li>
      ))}
      </ul>
    </section>
  )
}
