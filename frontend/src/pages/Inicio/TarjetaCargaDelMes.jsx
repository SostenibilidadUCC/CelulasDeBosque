import Icono from '../../components/Icono.jsx'
import { DotPattern } from '../../components/ui/dot-pattern.jsx'
import { NumberTicker } from '../../components/ui/number-ticker.jsx'
import { ShineBorder } from '../../components/ui/shine-border.jsx'
import BarraAvance from './BarraAvance.jsx'
import { nombreDelPeriodo } from './avance.js'

const numero = new Intl.NumberFormat('es-AR')

// Texto de los días que faltan para el cierre del mes.
// El vencimiento a fin de mes es la propuesta de RN-16, todavía a confirmar con la clienta.
// El número de días lo calcula el backend en hora de Córdoba.
function textoCierre(dias) {
  if (dias === 0) return 'Cierra hoy'
  if (dias === 1) return 'Cierra mañana'
  return `Cierra en ${dias} días`
}

// INI-02: avance de carga del mes del lugar del cargador, con un solo dato (lo que falta)
// Sin botón para cargar: eso es el botón Cargar de la barra (un solo camino para cargar).
export default function TarjetaCargaDelMes({ cargadas, total, periodo, diasHastaVencimiento }) {

  const mes = nombreDelPeriodo(periodo).split(' ')[0] // "octubre"
  const faltan = total - cargadas

  // Tarjeta en verde bosque con el número grande en la tipografía de títulos,
  // para que sea lo primero que se ve.
  if (faltan <= 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-bosque p-5 text-white shadow-nivel-2 sm:p-6">
        <Textura />
        <div className="relative flex items-center gap-3">
          <Icono nombre="task_alt" className="text-brote" />
          <p className="font-titulo text-headline-md font-semibold">¡Listo! Cargaste todas las células de {mes}.</p>
        </div>
      </div>
    )
  }

  // ShineBorder (Magic UI): un brillo verde suave recorre el borde mientras quedan células por
  // cargar. Es lento (14 s por vuelta) y se apaga si el teléfono pide menos movimiento.
  return (
    <div className="relative overflow-hidden rounded-2xl bg-bosque p-5 text-white shadow-nivel-2 sm:p-6">
      <Textura />
      <ShineBorder borderWidth={2} shineColor={['var(--color-hoja-suave)', 'var(--color-brote)']} />
      <div className="relative flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="flex items-center gap-2 text-label-lg font-medium text-brote">
          <Icono nombre="eco" />
          Carga de {mes}
        </p>
        <p className="flex items-center gap-1 text-body-md text-brote">
          <Icono nombre="schedule" className="text-[20px]" />
          {textoCierre(diasHastaVencimiento)}
        </p>
      </div>

      {/* El número cuenta hacia arriba una sola vez al entrar (NumberTicker de Magic UI).
          El texto completo queda en sr-only para que el lector de pantalla no lea la animación. */}
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="sr-only">
          {numero.format(faltan)} {faltan === 1 ? 'célula te falta cargar' : 'células te faltan cargar'}
        </span>
        <NumberTicker
          aria-hidden="true"
          value={faltan}
          className="font-titulo text-[64px]/none font-bold"
        />
        <span aria-hidden="true" className="text-headline-sm font-medium">
          {faltan === 1 ? 'célula te falta cargar' : 'células te faltan cargar'}
        </span>
      </p>

      {/* Solo la barra: "Cargaste X de Y" repetía lo mismo que el número grande. */}
      <BarraAvance
        cargadas={cargadas}
        total={total}
        etiqueta={`Avance de carga de ${mes}`}
        claseRiel="bg-bosque-hover"
      />

      </div>
    </div>
  )
}


// DotPattern (Magic UI): puntitos blancos muy tenues, que se desvanecen hacia la izquierda
// para que el texto quede sobre fondo liso. Es solo textura: no se mueve ni dice nada.
function Textura() {
  return (
    <DotPattern
      width={18}
      height={18}
      cr={1.2}
      className="text-white/15 [mask-image:linear-gradient(to_left,white,transparent_75%)]"
    />
  )
}
