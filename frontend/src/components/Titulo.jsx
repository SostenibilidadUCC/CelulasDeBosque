// Títulos con el tamaño correcto en celular y en computadora (frontend/CLAUDE.md, Tipografía).
// "text-[22px]/[30px]" quiere decir tamaño 22 px con interlineado 30 px.
// Los títulos de pantalla (xl y lg) van en la tipografía de títulos (Fraunces), igual que en el Inicio,
// para que todas las pantallas se vean de la misma familia.
const estilos = {
  xl: 'font-titulo text-[28px]/9 font-bold tracking-[-0.01em] md:text-headline-xl md:tracking-[-0.02em]',
  lg: 'font-titulo text-[24px]/[32px] font-semibold tracking-[-0.01em] md:text-headline-lg',
  md: 'text-headline-md font-semibold tracking-[-0.005em]',
  sm: 'text-headline-sm font-semibold',
}

const etiquetas = { xl: 'h1', lg: 'h1', md: 'h2', sm: 'h3' }

export default function Titulo({ nivel = 'lg', como, className = '', children }) {
  const Etiqueta = como ?? etiquetas[nivel]
  return <Etiqueta className={`text-texto ${estilos[nivel]} ${className}`}>{children}</Etiqueta>
}