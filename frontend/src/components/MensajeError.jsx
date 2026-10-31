import { Alert } from '@/components/ui/alert'
import Boton from './Boton.jsx'
import Icono from './Icono.jsx'

// Error de pantalla: qué pasó y botón "Reintentar". El rojo es solo para errores, nunca para plantas.
// Por dentro usa el Alert de shadcn (ya trae role="alert").
export default function MensajeError({ mensaje, onReintentar }) {
  return (
    <Alert className="flex flex-col items-center gap-2 rounded-2xl border-error-fondo bg-error-fondo p-4 text-center text-error-texto">
      <Icono nombre="cloud_off" tamano="grande" />
      <p className="text-body-md font-medium">{mensaje}</p>
      {onReintentar && (
        <Boton variante="secundario" icono="refresh" onClick={onReintentar} className="mt-1 max-w-xs">
          Reintentar
        </Boton>
      )}
    </Alert>
  )
}
