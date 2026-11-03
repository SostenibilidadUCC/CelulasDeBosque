import { useState } from 'react'

// Foto de un registro. La pide a GET /api/fotos/{id} (T13 de Magda), que revisa los permisos.
// Si no hay foto o no se pudo cargar, no se muestra nada (igual que en components/Foto.jsx):
// un recuadro de "Foto no disponible" no le sirve a quien mira la ficha.
// onFallo (opcional): avisa que la foto no cargó, para que quien la usa oculte lo que va con ella.
export default function FotoRegistro({ fotoId, descripcion, className = '', onFallo }) {
  const [fallo, setFallo] = useState(false)

  if (fotoId == null || fallo) return null

  return (
    <img
      src={`/api/fotos/${fotoId}`}
      alt={descripcion}
      loading="lazy"
      onError={() => {
        setFallo(true)
        onFallo?.()
      }}
      className={`aspect-[4/3] w-full rounded-xl bg-gris-suave object-cover ${className}`}
    />
  )
}
