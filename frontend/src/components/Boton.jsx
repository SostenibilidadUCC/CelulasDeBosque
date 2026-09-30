const variantes = {
  primario: 'bg-primario text-white hover:bg-primario-hover',
  secundario: 'border-[1.5px] border-borde-verde bg-superficie text-primario hover:bg-primario-claro',
  tonal: 'bg-primario-claro text-primario hover:bg-vivo-fondo',
  peligro: 'bg-error text-white hover:opacity-90',
}

export default function Boton({ children, variante = 'primario', type = 'button', className = '', ...resto }) {
  return (
    <button
      type={type}
      className={`min-h-12 w-full rounded-control px-4 text-[15px] font-medium transition hover:-translate-y-px disabled:opacity-50 disabled:hover:translate-y-0 ${variantes[variante]} ${className}`}
      {...resto}
    >
      {children}
    </button>
  )
}