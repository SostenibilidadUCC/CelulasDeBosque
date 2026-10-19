import { useNavigate } from 'react-router'
import Boton from '../../components/Boton.jsx'
import CodigoCelula from '../../components/CodigoCelula.jsx'
import Icono from '../../components/Icono.jsx'
import Titulo from '../../components/Titulo.jsx'
import { periodoEnTexto } from './fechas.js'

// Encabezado de la carga mensual: qué célula es, de qué período es el registro y si es nuevo
// o se está editando el de este mes.
// - periodo: el de la fecha elegida ("2026-10"). Cambia si se elige una fecha de otro mes.
// - periodoActual y editando: el aviso de abajo habla siempre del mes en curso.
export default function EncabezadoCarga({ celula, periodo, periodoActual, editando }) {
  const navigate = useNavigate()

  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Titulo nivel="lg">Carga mensual</Titulo>
          <div className="flex flex-wrap items-center gap-2">
            <CodigoCelula codigo={celula.codigo} className="text-label-lg" />
            <span className="text-body-md text-texto-2">
              {celula.lugar} · Isleta {celula.isleta}
            </span>
          </div>
          <p className="text-body-md text-texto-2">
            Registro de <span className="font-semibold text-texto">{periodoEnTexto(periodo)}</span>
          </p>
        </div>
        {/* "Cambiar" lleva al plano de la isleta de la célula: desde ahí se elige otra y se toca Cargar.
            TODO T17: hoy, si hay datos cargados, se pierden al cambiar de célula (el borrador en el
            celular es el ticket T17). */}
        <div className="w-32 shrink-0">
          <Boton variante="secundario" icono="swap_horiz" onClick={() => navigate(`/isletas/${celula.isletaId}`)}>
            Cambiar
          </Boton>
        </div>
      </div>

      {editando ? (
        <p className="flex items-start gap-2 rounded-2xl bg-tonal p-4 text-body-md text-bosque">
          <Icono nombre="edit_note" tamano="chico" className="mt-0.5" />
          Esta célula ya tiene el registro de {periodoEnTexto(periodoActual)}: estás editándolo.
        </p>
      ) : (
        <p className="flex items-start gap-2 rounded-2xl bg-brote p-4 text-body-md text-bosque">
          <Icono nombre="add_circle" tamano="chico" className="mt-0.5" />
          Registro nuevo: esta célula todavía no tiene el registro de {periodoEnTexto(periodoActual)}.
        </p>
      )}
    </header>
  )
}
