import { useEffect, useState } from 'react'
import { listarLugaresAdmin } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import Cargando from '../../components/Cargando.jsx'
import Icono from '../../components/Icono.jsx'
import MensajeError from '../../components/MensajeError.jsx'
import Titulo from '../../components/Titulo.jsx'
import Vacio from '../../components/Vacio.jsx'
import { useSesion } from '../../sesion/useSesion.js'
import FormularioIsleta from './FormularioIsleta.jsx'
import FormularioLugar from './FormularioLugar.jsx'
import TarjetaLugar from './TarjetaLugar.jsx'

// Pantalla Lugares e isletas (T20, LUG-01 a 04). Solo para administradores.
// Lista todos los lugares, también los deshabilitados, con sus isletas. El plano y la creación
// de células en lote de cada isleta están en otra pantalla (IsletaAdmin).
export default function Lugares() {
  const { usuario } = useSesion()

  // Es solo experiencia de uso: el permiso real lo valida el backend (y un 403 se muestra igual).
  return (
    <div className="flex flex-col gap-4 py-4">
      <Titulo>Lugares e isletas</Titulo>
      {usuario.rol === 'admin' ? <ListaLugares /> : <SinPermiso />}
    </div>
  )
}

export function SinPermiso() {
  return <Vacio icono="lock" titulo="Esta sección es solo para administradores" mensaje="Si necesitás cambiar un lugar o una isleta, pedíselo a un administrador." />
}

function ListaLugares() {
  const [carga, setCarga] = useState({ cargando: true })
  const [intento, setIntento] = useState(0)
  // Lo que está abierto: { tipo: 'lugar', lugar? } o { tipo: 'isleta', lugar, isleta? }.
  // Sin lugar (o sin isleta) es para crear uno nuevo; con él, para editarlo.
  const [formulario, setFormulario] = useState(null)
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    let cancelado = false
    listarLugaresAdmin()
      .then((respuesta) => {
        if (!cancelado) setCarga({ lugares: respuesta.lugares })
      })
      .catch((error) => {
        if (!cancelado) setCarga({ error })
      })
    return () => {
      cancelado = true
    }
  }, [intento])

  // El aviso de "Listo…" se va solo a los 4 segundos.
  useEffect(() => {
    if (!aviso) return
    const temporizador = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(temporizador)
  }, [aviso])

  // Al guardar se cierra el formulario, se avisa y se vuelve a pedir la lista (sin mostrar "cargando").
  function alGuardar(texto) {
    setFormulario(null)
    setAviso(texto)
    setIntento((n) => n + 1)
  }

  if (carga.error) {
    if (carga.error.estado === 403) return <SinPermiso />
    return (
      <MensajeError
        mensaje={carga.error.message}
        onReintentar={() => {
          setCarga({ cargando: true })
          setIntento((n) => n + 1)
        }}
      />
    )
  }
  if (carga.cargando) return <Cargando filas={3} />

  return (
    <>
      {aviso && (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-tonal p-3 text-body-md text-bosque">
          <Icono nombre="check_circle" className="shrink-0" />
          {aviso}
        </p>
      )}

      <Boton icono="add_location_alt" className="sm:w-auto sm:self-start" onClick={() => setFormulario({ tipo: 'lugar' })}>
        Agregar lugar
      </Boton>

      {carga.lugares.length === 0 ? (
        <Vacio icono="location_on" titulo="Todavía no hay lugares" mensaje="Agregá el primero: el Campus UCC o un colegio adherido." />
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {carga.lugares.map((lugar) => (
            <li key={lugar.id}>
              <TarjetaLugar
                lugar={lugar}
                onEditar={() => setFormulario({ tipo: 'lugar', lugar })}
                onAgregarIsleta={() => setFormulario({ tipo: 'isleta', lugar })}
                onEditarIsleta={(isleta) => setFormulario({ tipo: 'isleta', lugar, isleta })}
              />
            </li>
          ))}
        </ul>
      )}

      {/* "key" hace que el formulario arranque de cero cada vez que se abre para otro lugar o isleta. */}
      {formulario?.tipo === 'lugar' && (
        <FormularioLugar key={formulario.lugar?.id ?? 'nuevo'} lugar={formulario.lugar} onCerrar={() => setFormulario(null)} onGuardado={alGuardar} />
      )}
      {formulario?.tipo === 'isleta' && (
        <FormularioIsleta
          key={formulario.isleta?.id ?? `nueva-${formulario.lugar.id}`}
          lugar={formulario.lugar}
          isleta={formulario.isleta}
          onCerrar={() => setFormulario(null)}
          onGuardado={alGuardar}
        />
      )}
    </>
  )
}
