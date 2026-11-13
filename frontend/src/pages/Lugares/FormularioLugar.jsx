import { useState } from 'react'
import { crearLugar, editarLugar } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import Icono from '../../components/Icono.jsx'
import Modal from '../../components/Modal.jsx'
import DosOpciones from './DosOpciones.jsx'

const tipos = [
  { valor: 'universidad', texto: 'Universidad', icono: 'school' },
  { valor: 'colegio', texto: 'Colegio', icono: 'account_balance' },
]
const estados = [
  { valor: true, texto: 'Habilitado', icono: 'visibility' },
  { valor: false, texto: 'Deshabilitado', icono: 'visibility_off' },
]

// Formulario para crear (sin "lugar") o editar un lugar (LUG-01 a 03).
// No pide "público": todo lugar habilitado es público (RN-15). La ubicación en el mapa queda
// para cuando exista el mapa (MAP-01 a 03).
export default function FormularioLugar({ lugar, onCerrar, onGuardado }) {
  const editando = Boolean(lugar)
  const [datos, setDatos] = useState({
    letra: lugar?.letra ?? '',
    nombre: lugar?.nombre ?? '',
    tipo: lugar?.tipo ?? 'colegio',
    localidad: lugar?.localidad ?? '',
    activo: lugar?.activo ?? true,
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  // RN-03: con registros, la letra ya se usó en el campo y no se puede cambiar.
  const letraFija = editando && lugar.tieneRegistros

  const cambiar = (campo) => (valor) => setDatos((anteriores) => ({ ...anteriores, [campo]: valor }))

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setError(null)
    const cuerpo = { ...datos, letra: datos.letra.trim().toUpperCase() }
    try {
      const guardado = editando ? await editarLugar(lugar.id, cuerpo) : await crearLugar(cuerpo)
      onGuardado(editando ? `Listo, se guardaron los cambios de ${guardado.nombre}.` : `Listo, se agregó ${guardado.nombre} con la letra ${guardado.letra}.`)
    } catch (err) {
      setError(err.message) // los mensajes del backend ya están en español y dicen qué corregir
      setGuardando(false)
    }
  }

  return (
    <Modal abierto titulo={editando ? `Editar ${lugar.nombre}` : 'Agregar lugar'} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <CampoTexto
            etiqueta="Letra"
            value={datos.letra}
            onChange={(e) => cambiar('letra')(e.target.value)}
            maxLength={1}
            autoCapitalize="characters"
            autoComplete="off"
            disabled={letraFija}
            required
            className="w-20 text-center uppercase"
          />
          <p className="text-body-sm text-texto-3">
            {letraFija
              ? 'No se puede cambiar: el lugar ya tiene registros y su letra está en los códigos de las células.'
              : 'Es la primera parte del código de cada célula, como la A de A-1-45.'}
          </p>
        </div>
        <CampoTexto etiqueta="Nombre" value={datos.nombre} onChange={(e) => cambiar('nombre')(e.target.value)} maxLength={100} required />
        <DosOpciones etiqueta="Tipo" opciones={tipos} valor={datos.tipo} onCambiar={cambiar('tipo')} />
        <CampoTexto etiqueta="Localidad (opcional)" value={datos.localidad} onChange={(e) => cambiar('localidad')(e.target.value)} maxLength={100} />

        {editando && (
          <div className="flex flex-col gap-1.5">
            <DosOpciones etiqueta="Estado" opciones={estados} valor={datos.activo} onCambiar={cambiar('activo')} />
            <p className="text-body-sm text-texto-3">
              Deshabilitado, el lugar no aparece en los listados, el mapa ni las métricas. Sus datos no se borran.
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-error-fondo p-3 text-body-md text-error-texto">
            <Icono nombre="error" className="shrink-0" />
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando} className="sm:w-auto">
            Cancelar
          </Boton>
          <Boton type="submit" cargando={guardando} className="sm:w-auto">
            {editando ? 'Guardar cambios' : 'Agregar lugar'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}
