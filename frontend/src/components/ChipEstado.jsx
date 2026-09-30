// Estados de la célula en el mes (sección 5 del documento v3) y de los individuos.
// Nombres a confirmar con Cande en T05: ella hace EstadoCelula en T11.
const estados = {
  'al-dia': { texto: 'Al día', icono: '✓', clases: 'bg-vivo-fondo border-vivo-borde text-vivo-texto' },
  pendiente: { texto: 'Pendiente', icono: '!', clases: 'bg-pendiente-fondo border-pendiente-borde text-pendiente-texto' },
  'sin-registro': { texto: 'Sin registro inicial', icono: '–', clases: 'bg-muerto-fondo border-muerto-borde text-muerto-texto' },
  'fuera-de-termino': { texto: 'Fuera de término', icono: '✓', clases: 'bg-vivo-fondo border-pendiente-borde text-vivo-texto' },
  baja: { texto: 'Dada de baja', icono: '✕', clases: 'bg-muerto-fondo border-muerto-borde text-muerto-texto line-through' },
  vivo: { texto: 'Vivo', icono: '🌿', clases: 'bg-vivo-fondo border-vivo-borde text-vivo-texto' },
  muerto: { texto: 'Muerto', icono: '–', clases: 'bg-muerto-fondo border-muerto-borde text-muerto-texto' },
}

export default function ChipEstado({ estado }) {
  const e = estados[estado] ?? estados['sin-registro']
  return (
    <span className={`inline-flex h-7 items-center gap-1 rounded-full border px-3 text-sm font-medium ${e.clases}`}>
      <span aria-hidden="true">{e.icono}</span>
      {e.texto}
    </span>
  )
}