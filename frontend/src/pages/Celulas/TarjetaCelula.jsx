import { Link, useNavigate } from 'react-router'
import Boton from '../../components/Boton.jsx'
import ChipEstado from '../../components/ChipEstado.jsx'
import CodigoCelula from '../../components/CodigoCelula.jsx'
import Icono from '../../components/Icono.jsx'
import { fechaCorta } from './fechas.js'

// Estado de un individuo según su último registro: vivo true, false, o null si nunca se registró.
function estadoIndividuo(vivo) {
  if (vivo === true) return 'vivo'
  if (vivo === false) return 'muerto'
  return 'sin-datos'
}

// EXP-03: tarjeta de una célula. Toda la tarjeta lleva a la ficha (T15 de Fran).
// Para eso se usa un "enlace estirado": el Link del código tiene un pseudo-elemento ::after
// invisible que cubre toda la tarjeta (after:absolute after:inset-0). El botón de cargar va
// "encima" (relative z-10), así se puede tocar sin abrir la ficha. Es mejor que poner un botón
// adentro de un enlace, que en HTML no es válido.
export default function TarjetaCelula({ celula, puedeEditar }) {
  const navigate = useNavigate()
  const registro = celula.ultimoRegistro
  // EXP-04: solo si puede editar el lugar, y nunca en una célula dada de baja.
  const puedeCargar = puedeEditar && celula.estado !== 'baja'

  return (
    <article className="relative flex h-full flex-col gap-3 rounded-2xl border border-borde bg-superficie p-4 shadow-nivel-1 transition duration-150 ease-out hover:border-niebla">
      <div className="flex items-center justify-between gap-2">
        <Link
          to={`/celulas/${celula.id}`}
          aria-label={`Ver ficha de la célula ${celula.codigo}`}
          className="rounded-full after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque-hover"
        >
          <CodigoCelula codigo={celula.codigo} />
        </Link>
        <ChipEstado estado={celula.estado} />
      </div>

      {/* TODO (T13 de Magda): mostrar la foto del último registro con /api/fotos/{fotoId}. */}
      <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-gris-suave">
        <Icono nombre="photo_camera" tamano="grande" className="text-placeholder" />
        <span className="sr-only">
          {registro ? 'La foto todavía no se puede mostrar' : 'Todavía no tiene foto'}
        </span>
      </div>

      <p className="text-body-md text-texto-2">
        Isleta {celula.isleta.numero} ·{' '}
        {registro ? `Último registro: ${fechaCorta(registro.fecha)}` : 'Sin registros'}
      </p>

      <ul className="flex flex-col gap-2">
        {celula.individuos.map((ind) => (
          <li key={ind.formaDeVida} className="flex items-center gap-2">
            <Icono nombre={ind.icono} tamano="chico" className="text-bosque-hover" />
            <span className="flex-1 text-body-md text-texto">{ind.nombre}</span>
            <ChipEstado estado={estadoIndividuo(ind.vivo)} />
          </li>
        ))}
      </ul>

      {puedeCargar && (
        <Boton variante="tonal" icono="edit_note" className="relative z-10 mt-auto" onClick={() => navigate(`/cargar/${celula.id}`)}>
          Cargar registro del mes
        </Boton>
      )}
    </article>
  )
}
