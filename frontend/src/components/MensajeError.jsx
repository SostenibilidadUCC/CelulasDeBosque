import Boton from './Boton.jsx'
import Icono from './Icono.jsx'

// Error de pantalla: qué pasó y botón "Reintentar". El rojo es solo para errores, nunca para plantas.
export default function MensajeError({ mensaje, onReintentar }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-2xl bg-error-fondo p-4 text-center text-error-texto">
      <Icono nombre="cloud_off" tamano="grande" />
      <p className="text-body-md font-medium">{mensaje}</p>
      {onReintentar && (
        <Boton variante="secundario" icono="refresh" onClick={onReintentar} className="mt-1 max-w-xs">
          Reintentar
        </Boton>
      )}
    </div>
  )
}