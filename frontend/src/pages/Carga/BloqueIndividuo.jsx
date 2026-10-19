import Boton from '../../components/Boton.jsx'
import BotonesSiNo from '../../components/BotonesSiNo.jsx'
import BotonesVivoMuerto from '../../components/BotonesVivoMuerto.jsx'
import ChipEstado from '../../components/ChipEstado.jsx'
import Icono from '../../components/Icono.jsx'
import SelectorNumero from '../../components/SelectorNumero.jsx'
import Titulo from '../../components/Titulo.jsx'
import { ALTURA_MAX, ALTURA_MIN, FLORES_MAX, FLORES_MIN } from './individuos.js'

// Opciones de los desplegables. La altura tiene además "Elegí" (sin valor) para el registro inicial,
// cuando todavía no hay altura del mes anterior. SelectorNumero acepta opciones { valor, texto }.
const OPCIONES_ALTURA = [
  { valor: '', texto: 'Elegí' },
  ...Array.from({ length: ALTURA_MAX - ALTURA_MIN + 1 }, (_, i) => ALTURA_MIN + i),
]
const OPCIONES_FLORES = Array.from({ length: FLORES_MAX - FLORES_MIN + 1 }, (_, i) => FLORES_MIN + i)

// Bloque de un individuo en la carga mensual (T14). No guarda datos propios: todo viene por props.
// - forma: { formaDeVida, nombre, icono }, del catálogo que manda el backend.
// - individuo: { formaDeVida, vivo, alturaCm, flores, frutos, plantulasNuevas } (vivo null = sin elegir).
// - estabaMuerto: si en el registro anterior figuraba muerto (solo ahí aparece la reposición).
// - error: el mensaje de validación, o null.
// - onCambiar(cambios): cambia uno o más datos del individuo vivo.
// - onElegirVivo(): pasa de "sin elegir" o "muerto" a vivo con los valores iniciales.
// - onPedirMuerto() y onPedirReposicion(): abren la confirmación (el Modal vive en FormularioCarga).
export default function BloqueIndividuo({
  forma,
  individuo,
  estabaMuerto,
  error,
  onCambiar,
  onElegirVivo,
  onPedirMuerto,
  onPedirReposicion,
}) {
  // Muerto (RN-09): gris, sin controles, con el texto "Muerto" y un solo botón.
  if (individuo.vivo === false) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-gris-borde bg-gris-suave p-4">
        <div className="flex items-center justify-between gap-2">
          <Titulo nivel="sm" como="h3" className="flex items-center gap-2 text-texto-2!">
            <Icono nombre={forma.icono} className="text-texto-3" />
            {forma.nombre}
          </Titulo>
          <ChipEstado estado="muerto" />
        </div>
        <p className="text-body-md text-texto-2">No se carga nada más para este individuo.</p>
        {estabaMuerto ? (
          <Boton variante="tonal" icono="autorenew" onClick={onPedirReposicion}>
            Cargar uno nuevo (reposición)
          </Boton>
        ) : (
          <Boton variante="texto" icono="undo" onClick={onElegirVivo}>
            Cambiar a Vivo
          </Boton>
        )}
      </section>
    )
  }

  function cambiarVivo(vivo) {
    if (vivo === false) onPedirMuerto()
    else if (individuo.vivo !== true) onElegirVivo()
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-borde bg-superficie p-4 shadow-nivel-1">
      <Titulo nivel="sm" como="h3" className="flex items-center gap-2">
        <Icono nombre={forma.icono} className="text-bosque-hover" />
        {forma.nombre}
      </Titulo>

      <BotonesVivoMuerto vivo={individuo.vivo} onChange={cambiarVivo} />

      {individuo.vivo === true && (
        <>
          <SelectorNumero
            etiqueta="Altura (cm)"
            icono="height"
            valor={individuo.alturaCm}
            opciones={OPCIONES_ALTURA}
            onChange={(valor) => onCambiar({ alturaCm: valor === '' ? null : valor })}
          />
          <SelectorNumero
            etiqueta="Cantidad de flores"
            icono="filter_vintage"
            valor={individuo.flores}
            opciones={OPCIONES_FLORES}
            onChange={(valor) => onCambiar({ flores: valor })}
          />
          <BotonesSiNo
            etiqueta="Presencia de frutos"
            icono="nutrition"
            valor={individuo.frutos}
            onChange={(valor) => onCambiar({ frutos: valor })}
          />
          <BotonesSiNo
            etiqueta="Nuevas plántulas"
            icono="psychiatry"
            valor={individuo.plantulasNuevas}
            onChange={(valor) => onCambiar({ plantulasNuevas: valor })}
          />
        </>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-1 text-body-sm text-error">
          <Icono nombre="error" tamano="chip" />
          {error}
        </p>
      )}
    </section>
  )
}
