import Icono from './Icono.jsx'

// Estados de la célula en el mes (sección 5 del documento v4) y de los individuos (Vivo/Muerto).
// Colores e íconos de frontend/CLAUDE.md. Los nombres de los estados de la célula tienen que
// coincidir con los que devuelva EstadoCelula (Cande, T11).
const estados = {
  vivo: { texto: 'Vivo', icono: 'eco', clases: 'border-brote-borde bg-brote text-bosque', colorIcono: 'text-bosque-hover' },
  muerto: { texto: 'Muerto', icono: 'remove_circle', clases: 'border-gris-borde bg-gris-suave text-texto-2', colorIcono: 'text-texto-3' },
  'al-dia': { texto: 'Al día', icono: 'check_circle', clases: 'border-brote-borde bg-brote text-bosque', colorIcono: 'text-bosque-hover' },
  pendiente: { texto: 'Pendiente', icono: 'schedule', clases: 'border-pendiente-borde bg-pendiente text-pendiente-texto', colorIcono: '' },
  'sin-registro': { texto: 'Sin registro inicial', icono: 'hourglass_empty', clases: 'border-gris-borde bg-gris-suave text-texto-2', colorIcono: '' },
  'fuera-de-termino': { texto: 'Fuera de término', icono: 'check_circle', clases: 'border-pendiente-borde bg-brote text-bosque', colorIcono: 'text-bosque-hover' },
  baja: { texto: 'Dada de baja', icono: 'block', clases: 'border-gris-borde bg-gris-suave text-texto-3 line-through', colorIcono: '' },
}

export default function ChipEstado({ estado }) {
  const e = estados[estado] ?? estados['sin-registro']
  return (
    <span className={`inline-flex h-7 items-center gap-1 rounded-full border px-3 text-label-sm font-semibold tracking-[0.02em] ${e.clases}`}>
      <Icono nombre={e.icono} tamano="chip" className={e.colorIcono} />
      {e.texto}
    </span>
  )
}