import { useState } from 'react'
import Boton from '../../components/Boton.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import Icono from '../../components/Icono.jsx'
import PanelInferior from '../../components/PanelInferior.jsx'
import Selector from '../Celulas/Selector.jsx'
import GenerarContrasena from './GenerarContrasena.jsx'
import { opcionesDePermiso } from './textos.js'

// Panel para elegir qué puede hacer una persona. Sirve para aprobar un pedido (aprobando = true)
// y para cambiar los permisos de quien ya tiene cuenta.
// Usuarios.jsx lo dibuja con key={usuario.id}: así cada vez que se abre arranca con los datos de esa persona.
// onGuardar recibe { nombre, rol, lugarId }; error es el mensaje si el guardado falló.
export default function PanelPermisos({ usuario, lugares, aprobando, guardando, error, onGuardar, onCerrar }) {
  const [nombre, setNombre] = useState(usuario.nombre)
  // Al aprobar no hay nada elegido: el rol "lector" que viene del backend es solo un relleno.
  const [rol, setRol] = useState(aprobando ? '' : usuario.rol)
  const [lugarId, setLugarId] = useState(usuario.lugar ? String(usuario.lugar.id) : '')

  const opcionesLugar = [
    { valor: '', texto: 'Elegí un lugar' },
    ...lugares.map((l) => ({ valor: String(l.id), texto: `${l.letra} · ${l.nombre}` })),
  ]
  const faltaLugar = rol === 'cargador' && !lugarId
  const puedeGuardar = rol !== '' && !faltaLugar && nombre.trim() !== ''

  function enviar(e) {
    e.preventDefault()
    onGuardar({ nombre: nombre.trim(), rol, lugarId: rol === 'cargador' ? Number(lugarId) : null })
  }

  return (
    <PanelInferior abierto titulo={aprobando ? `Aprobar a ${usuario.nombre}` : 'Cambiar permisos'} onCerrar={onCerrar}>
      <form onSubmit={enviar} className="flex flex-col gap-4">
        {aprobando ? (
          <div className="text-body-md text-texto-2">
            <p className="break-all">{usuario.email}</p>
            {usuario.institucion && <p>{usuario.institucion}</p>}
          </div>
        ) : (
          <CampoTexto etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100} required />
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-label-md font-medium text-texto-2">¿Qué puede hacer?</legend>
          {opcionesDePermiso.map((o) => {
            const elegida = rol === o.valor
            return (
              <label
                key={o.valor}
                className="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border-[1.5px] border-niebla bg-superficie p-3 has-checked:border-bosque has-checked:bg-tonal has-focus-visible:outline-2 has-focus-visible:outline-bosque-hover"
              >
                <input type="radio" name="permiso" value={o.valor} checked={elegida} onChange={() => setRol(o.valor)} className="sr-only" />
                <Icono nombre={elegida ? 'radio_button_checked' : 'radio_button_unchecked'} className={elegida ? 'text-bosque' : 'text-texto-3'} />
                <span className="flex flex-col">
                  <span className="text-label-lg font-medium text-texto">{o.nombre}</span>
                  <span className="text-body-md text-texto-2">{o.explicacion}</span>
                </span>
              </label>
            )
          })}
        </fieldset>

        {rol === 'cargador' && <Selector etiqueta="¿De qué lugar?" valor={lugarId} onChange={setLugarId} opciones={opcionesLugar} />}

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-error-fondo p-3 text-body-md text-error-texto">
            <Icono nombre="error" className="shrink-0" />
            {error}
          </p>
        )}

        <Boton type="submit" disabled={!puedeGuardar} cargando={guardando} textoCargando="Guardando…" icono={aprobando ? 'how_to_reg' : 'check'}>
          {aprobando ? 'Aprobar y dar acceso' : 'Guardar cambios'}
        </Boton>
      </form>

      {/* Fuera del formulario: generar la contraseña no guarda los cambios de permisos, y al revés. */}
      {!aprobando && usuario.estado === 'activo' && (
        <div className="mt-6">
          <GenerarContrasena usuario={usuario} />
        </div>
      )}
    </PanelInferior>
  )
}
