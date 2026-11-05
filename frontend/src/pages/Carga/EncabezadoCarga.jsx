import Icono from '../../components/Icono.jsx'
import Titulo from '../../components/Titulo.jsx'
import ElegirCelula from './ElegirCelula.jsx'
import { mesEnMinuscula } from './fechas.js'

// Encabezado de la carga mensual: de qué mes es el registro y qué célula es.
// - periodo: el de la fecha elegida ("2026-10"). Cambia si se elige una fecha de otro mes.
// - editando: si ya existía el registro de este mes. Solo en ese caso se muestra un aviso;
//   si es nuevo no hace falta, el botón de abajo ya dice "Guardar registro de …".
// La célula se puede cambiar tocándola (ElegirCelula): se elige isleta y número.
export default function EncabezadoCarga({ celula, periodo, editando }) {
  return (
    <header className="flex flex-col gap-3">
      <Titulo nivel="lg">Registro de {mesEnMinuscula(periodo)}</Titulo>
      <ElegirCelula celula={celula} />

      {editando && (
        <p className="flex items-start gap-2 rounded-2xl bg-tonal p-4 text-body-md text-bosque">
          <Icono nombre="edit_note" tamano="chico" className="mt-0.5" />
          Ya está cargado: estás editándolo.
        </p>
      )}
    </header>
  )
}
