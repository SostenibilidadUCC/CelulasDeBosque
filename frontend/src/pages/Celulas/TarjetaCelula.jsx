import { useState } from 'react'
import { Link } from 'react-router'
import ChipEstado from '../../components/ChipEstado.jsx'
import CodigoCelula from '../../components/CodigoCelula.jsx'
import Icono from '../../components/Icono.jsx'
import { fechaCorta } from './fechas.js'

// Estados del mes en los que todavía falta cargar la célula.
const faltaCargar = ['pendiente', 'sin-registro']

// EXP-03: tarjeta de una célula. Toda la tarjeta lleva a la ficha (T15 de Fran).
// Para eso se usa un "enlace estirado": el Link del código tiene un pseudo-elemento ::after
// invisible que cubre toda la tarjeta (after:absolute after:inset-0).
// veEstado: el chip del mes (pendiente, al día) solo para quien carga en este lugar.
// "Dada de baja" se muestra siempre: no es un estado de carga, dice que la célula ya no se sigue.
export default function TarjetaCelula({ celula, puedeEditar, veEstado }) {
  // Si la foto no se puede cargar, se oculta (en la lista no sirve un recuadro de "no disponible").
  const [fotoFallo, setFotoFallo] = useState(false)
  const registro = celula.ultimoRegistro
  // EXP-04: solo si puede editar el lugar y a la célula le falta el registro del mes.
  // Si ya está al día, se edita desde la ficha.
  const puedeCargar = puedeEditar && faltaCargar.includes(celula.estado)
  // El estado del mes ya no va en un chip: lo dice el pie de la tarjeta ("Falta el registro
  // del mes" o "Registro del mes cargado"). Solo queda el chip de "Dada de baja".
  const cargadaEsteMes = veEstado && ['al-dia', 'fuera-de-termino'].includes(celula.estado)

  // Los 4 individuos en una sola línea: "4 de 4 vivos" y, si hay muertos, cuáles.
  const vivos = celula.individuos.filter((ind) => ind.vivo === true).length
  const muertos = celula.individuos.filter((ind) => ind.vivo === false).map((ind) => ind.nombre)

  return (
    <article className="relative flex h-full flex-col gap-3 rounded-2xl border border-borde bg-superficie p-4 shadow-nivel-1 transition duration-150 ease-out hover:border-bosque-hover">
      <div className="flex items-center justify-between gap-2">
        <Link
          to={`/celulas/${celula.id}`}
          aria-label={`Ver ficha de la célula ${celula.codigo}`}
          className="rounded-full after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque-hover"
        >
          <CodigoCelula codigo={celula.codigo} />
        </Link>
        {celula.estado === 'baja' && <ChipEstado estado="baja" />}
      </div>

      {/* La foto del último registro (GET /api/fotos/{id}, que revisa permisos). Si la célula
          todavía no tiene registros, no se muestra un recuadro vacío: la tarjeta queda más corta. */}
      {registro?.fotoId != null && !fotoFallo && (
        <img
          src={`/api/fotos/${registro.fotoId}`}
          alt={`Foto de la célula ${celula.codigo}, ${fechaCorta(registro.fecha)}`}
          loading="lazy"
          onError={() => setFotoFallo(true)}
          className="aspect-[4/3] w-full rounded-xl bg-gris-suave object-cover"
        />
      )}

      {/* Sin la isleta: ya está en el código (A-1-45 es la isleta 1) y en el filtro. */}
      <p className="text-body-md text-texto-2">
        {registro ? `Último registro: ${fechaCorta(registro.fecha)}` : 'Sin registros'}
      </p>

      {/* Sin registros no hay nada que decir de los individuos (ya lo dice la línea de arriba). */}
      {registro && (
        <p className="flex items-center gap-1.5 text-body-md text-texto">
          <Icono nombre="eco" tamano="chico" className="text-bosque-hover" />
          {vivos} de {celula.individuos.length} vivos
          {muertos.length > 0 && <span className="text-texto-3">· Muerto: {muertos.join(', ')}</span>}
        </p>
      )}

      {/* Ya no hay botón de cargar acá: se carga desde el botón Cargar de la barra (o el plano).
          Queda el aviso de que falta, con color, ícono y texto. */}
      {puedeCargar && (
        <p className="mt-auto flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-pendiente-borde bg-pendiente text-label-md font-medium text-pendiente-texto">
          <Icono nombre="schedule" tamano="chico" />
          Falta el registro del mes
        </p>
      )}
      {/* Estado "Al día" con ícono y texto (nunca solo color), en el mismo lugar que el botón. */}
      {cargadaEsteMes && (
        <p className="mt-auto flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-brote text-label-md font-medium text-bosque">
          <Icono nombre="check_circle" tamano="chico" className="text-bosque-hover" />
          Registro del mes cargado
        </p>
      )}
    </article>
  )
}
