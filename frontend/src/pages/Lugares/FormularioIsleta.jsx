import { useState } from 'react'
import { crearIsleta, editarIsleta } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import Icono from '../../components/Icono.jsx'
import Modal from '../../components/Modal.jsx'

// Formulario para crear (sin "isleta") o editar una isleta (LUG-04).
// Al crearla se eligen las filas y columnas de la grilla; después se cambian junto con el plano.
export default function FormularioIsleta({ lugar, isleta, onCerrar, onGuardado }) {
  const editando = Boolean(isleta)
  // Los números van como texto mientras se escriben; se convierten al guardar.
  const [datos, setDatos] = useState({
    numero: String(isleta?.numero ?? lugar.siguienteIsleta), // LUG-04: sugiere el siguiente libre
    nombre: isleta?.nombre ?? '',
    filas: '10',
    columnas: '10',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  // RN-03: con registros, el número ya se usó en el campo y no se puede cambiar.
  const numeroFijo = editando && isleta.tieneRegistros

  const cambiar = (campo) => (e) => setDatos((anteriores) => ({ ...anteriores, [campo]: e.target.value }))
  // Solo dígitos: el celular abre el teclado numérico y no se cuelan letras.
  const soloDigitos = (campo) => (e) => setDatos((anteriores) => ({ ...anteriores, [campo]: e.target.value.replace(/\D/g, '') }))

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setError(null)
    const numero = Number(datos.numero)
    try {
      if (editando) {
        await editarIsleta(isleta.id, { numero, nombre: datos.nombre })
        onGuardado(`Listo, se guardaron los cambios de la isleta ${numero}.`)
      } else {
        await crearIsleta({ lugarId: lugar.id, numero, nombre: datos.nombre, filas: Number(datos.filas), columnas: Number(datos.columnas) })
        onGuardado(`Listo, se agregó la isleta ${lugar.letra}-${numero}. Tocala para cargar el plano.`)
      }
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal abierto titulo={editando ? `Editar la isleta ${lugar.letra}-${isleta.numero}` : `Agregar isleta en ${lugar.nombre}`} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <CampoTexto
            etiqueta="Número"
            value={datos.numero}
            onChange={soloDigitos('numero')}
            inputMode="numeric"
            maxLength={3}
            disabled={numeroFijo}
            required
            className="w-24 tabular-nums"
          />
          {numeroFijo && (
            <p className="text-body-sm text-texto-3">No se puede cambiar: la isleta ya tiene registros y su número está en los códigos de las células.</p>
          )}
        </div>
        <CampoTexto etiqueta="Nombre (opcional)" value={datos.nombre} onChange={cambiar('nombre')} maxLength={100} placeholder="Por ejemplo, frente al aula magna" />

        {!editando && (
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-2 gap-3">
              <CampoTexto etiqueta="Filas" value={datos.filas} onChange={soloDigitos('filas')} inputMode="numeric" maxLength={2} required className="tabular-nums" />
              <CampoTexto etiqueta="Columnas" value={datos.columnas} onChange={soloDigitos('columnas')} inputMode="numeric" maxLength={2} required className="tabular-nums" />
            </div>
            <p className="text-body-sm text-texto-3">De 1 a 30. Las podés cambiar después, al cargar el plano.</p>
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
            {editando ? 'Guardar cambios' : 'Agregar isleta'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}
