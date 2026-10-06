import Icono from './Icono.jsx'

// Estado vacío: ícono, título, una línea de explicación y, si corresponde, un botón (children).
export default function Vacio({ icono = 'eco', titulo, mensaje, children }) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <Icono nombre={icono} tamano="grande" className="text-placeholder" />
      {titulo && <h3 className="mt-3 text-headline-sm font-semibold text-texto">{titulo}</h3>}
      {mensaje && <p className="mt-1 max-w-sm text-body-md text-texto-2">{mensaje}</p>}
      {children && <div className="mt-4 w-full max-w-xs">{children}</div>}
    </div>
  )
}