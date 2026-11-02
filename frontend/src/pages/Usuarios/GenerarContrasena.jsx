import { useState } from 'react'
import { generarContrasenaNueva } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import Icono from '../../components/Icono.jsx'

// "¿Se olvidó la contraseña?" dentro del panel de una persona con acceso (AUT-05 simplificado).
// Pasos: botón → confirmación (en el mismo panel, sin abrir otra ventana encima) → la contraseña nueva
// con un botón para copiarla. El admin se la pasa por WhatsApp. La contraseña se muestra una sola vez:
// si se cierra el panel, hay que generar otra.
export default function GenerarContrasena({ usuario }) {
  const [paso, setPaso] = useState('inicio') // inicio | confirmar | lista
  const [generando, setGenerando] = useState(false)
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState(null)
  const [copiada, setCopiada] = useState(null) // null: sin tocar; true: copiada; false: no se pudo

  async function generar() {
    setGenerando(true)
    setError(null)
    try {
      const datos = await generarContrasenaNueva(usuario.id)
      setContrasena(datos.contrasena)
      setPaso('lista')
    } catch (err) {
      setError(err.message) // ya viene en español desde api.js
    }
    setGenerando(false)
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(contrasena)
      setCopiada(true)
    } catch {
      setCopiada(false) // por ejemplo, si el navegador no da permiso
    }
  }

  return (
    <section aria-labelledby="titulo-contrasena" className="flex flex-col gap-3 border-t border-borde pt-4">
      <h3 id="titulo-contrasena" className="text-headline-sm font-semibold text-texto">
        ¿Se olvidó la contraseña?
      </h3>

      {paso === 'inicio' && (
        <Boton variante="tonal" icono="key" onClick={() => setPaso('confirmar')}>
          Generar contraseña nueva
        </Boton>
      )}

      {paso === 'confirmar' && (
        <div className="flex flex-col gap-3 rounded-xl bg-tonal p-4">
          <p className="text-body-md text-texto">
            La contraseña actual de {usuario.nombre} deja de funcionar y se cierra su sesión en todos sus dispositivos.
          </p>
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-error-fondo p-3 text-body-md text-error-texto">
              <Icono nombre="error" className="shrink-0" />
              {error}
            </p>
          )}
          <Boton variante="secundario" icono="key" cargando={generando} textoCargando="Generando…" onClick={generar}>
            Sí, generar contraseña nueva
          </Boton>
          <Boton variante="texto" disabled={generando} onClick={() => setPaso('inicio')}>
            Cancelar
          </Boton>
        </div>
      )}

      {paso === 'lista' && (
        <div className="flex flex-col gap-3 rounded-xl border border-brote-borde bg-brote p-4">
          <p className="flex items-center gap-2 text-label-lg font-medium text-bosque">
            <Icono nombre="check_circle" />
            Contraseña nueva de {usuario.nombre}
          </p>
          {/* select-all: con un toque se selecciona entera, por si hay que copiarla a mano. */}
          <p className="rounded-lg bg-superficie px-4 py-3 text-center text-[24px]/[32px] font-semibold tracking-[0.12em] text-texto tabular-nums select-all">
            {contrasena}
          </p>
          <Boton variante="secundario" icono={copiada ? 'check' : 'content_copy'} onClick={copiar}>
            {copiada ? 'Copiada' : 'Copiar contraseña'}
          </Boton>
          {copiada === false && (
            <p role="alert" className="text-body-sm text-texto-2">
              No se pudo copiar. Tocá la contraseña para seleccionarla y copiala a mano.
            </p>
          )}
          <p className="text-body-md text-texto-2">
            Pasásela por WhatsApp. Por seguridad, no se vuelve a mostrar: si se pierde, generá otra.
          </p>
        </div>
      )}
    </section>
  )
}
