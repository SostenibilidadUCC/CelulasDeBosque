import { useState } from 'react'
import Icono from '../../components/Icono.jsx'

// Foto de un registro. La pide a GET /api/fotos/{id} (T13 de Magda), que revisa los permisos.
// Si todavía no hay foto o no se pudo cargar, muestra un recuadro gris en su lugar.
export default function FotoRegistro({ fotoId, descripcion, className = '' }) {
  const [fallo, setFallo] = useState(false)

  if (fotoId == null || fallo) {
    return (
      <div
        className={`flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-xl bg-gris-suave text-texto-3 ${className}`}
      >
        <Icono nombre="image_not_supported" />
        <span className="text-body-sm">Foto no disponible</span>
      </div>
    )
  }

  return (
    <img
      src={`/api/fotos/${fotoId}`}
      alt={descripcion}
      loading="lazy"
      onError={() => setFallo(true)}
      className={`aspect-[4/3] w-full rounded-xl bg-gris-suave object-cover ${className}`}
    />
  )
}