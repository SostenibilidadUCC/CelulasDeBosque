// Ícono de Material Symbols. Es decorativo (aria-hidden): el texto de al lado o el aria-label
// del botón es el que dice qué significa.
// El "!" del final hace que el tamaño le gane al tamaño fijo que trae la hoja de estilos de Google.
const tamanos = {
  chip: 'text-[16px]!',
  chico: 'text-[20px]!',
  normal: '',
  grande: 'text-[40px]!',
}

export default function Icono({ nombre, tamano = 'normal', relleno = false, className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined select-none ${tamanos[tamano]} ${relleno ? 'icono-relleno' : ''} ${className}`}
    >
      {nombre}
    </span>
  )
}