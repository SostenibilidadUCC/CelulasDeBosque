import { useState } from 'react'
import CodigoCelula from '../../components/CodigoCelula.jsx'
import Icono from '../../components/Icono.jsx'
import PanelElegirCelula from './PanelElegirCelula.jsx'

// Encabezado de la carga con la célula actual. Al tocarlo se abre el panel "Elegí la célula"
// (el mismo del botón Cargar de la barra) para saltar a otra célula del lugar.
// - celula: { id, codigo, lugarId, lugar, isletaId, isleta } de ultimo-registro.
export default function ElegirCelula({ celula }) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-haspopup="dialog"
        className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border-[1.5px] border-niebla bg-superficie px-3 text-left hover:bg-tonal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque-hover"
      >
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <CodigoCelula codigo={celula.codigo} className="text-label-lg" />
          <span className="text-body-md text-texto-2">
            {celula.lugar} · Isleta {celula.isleta}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-label-md font-medium text-bosque">
          Cambiar
          <Icono nombre="unfold_more" tamano="chico" />
        </span>
      </button>

      <PanelElegirCelula
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        lugarId={celula.lugarId}
        isletaId={celula.isletaId}
        celulaActualId={celula.id}
      />
    </>
  )
}
