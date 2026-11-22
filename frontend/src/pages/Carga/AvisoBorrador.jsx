import Boton from '../../components/Boton.jsx'
import Icono from '../../components/Icono.jsx'

// Aviso de la carga mensual cuando hay un borrador guardado en el celular (T17, CAR-16).
// Mientras se muestra, el formulario queda oculto: es el único botón primario de la pantalla.
// - onRetomar: carga en el formulario lo que estaba guardado.
// - onEmpezarDeNuevo: borra el borrador y abre el formulario con los valores precargados.
export default function AvisoBorrador({ onRetomar, onEmpezarDeNuevo }) {
  return (
    <section
      aria-labelledby="titulo-borrador"
      className="flex flex-col gap-4 rounded-2xl border border-borde bg-superficie p-4 shadow-nivel-1"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-tonal text-bosque">
          <Icono nombre="edit_note" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="titulo-borrador" className="text-headline-sm font-semibold text-texto">
            Tenés una carga sin guardar
          </h2>
          <p className="text-body-md text-texto-2">
            Quedó guardada en este celular. Podés seguir desde donde la dejaste o empezar de nuevo.
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Boton icono="restore" className="sm:order-2" onClick={onRetomar}>
          Retomar lo que cargaste
        </Boton>
        <Boton variante="secundario" icono="restart_alt" onClick={onEmpezarDeNuevo}>
          Empezar de nuevo
        </Boton>
      </div>
    </section>
  )
}
