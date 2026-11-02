import { useEffect, useState } from 'react'
import { editarUsuario, listarUsuarios, obtenerLugares } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import Cargando from '../../components/Cargando.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import Icono from '../../components/Icono.jsx'
import MensajeError from '../../components/MensajeError.jsx'
import Modal from '../../components/Modal.jsx'
import Titulo from '../../components/Titulo.jsx'
import Vacio from '../../components/Vacio.jsx'
import { useSesion } from '../../sesion/useSesion.js'
import PanelPermisos from './PanelPermisos.jsx'
import TarjetaUsuario from './TarjetaUsuario.jsx'
import { grupoDe, normalizar } from './textos.js'

// Pantalla Usuarios (T16, USR-01 a USR-07). Solo para administradores.
// Tres grupos con títulos claros: quién espera aprobación, quién tiene acceso y quién no.
// La búsqueda se hace en esta pantalla (la lista es corta), sin pedir nada al backend en cada letra.
export default function Usuarios() {
  const { usuario } = useSesion()

  // Es solo experiencia de uso: el permiso real lo valida el backend (y un 403 se muestra igual).
  return <Pagina>{usuario.rol === 'admin' ? <ListaUsuarios yoId={usuario.id} /> : <SinPermiso />}</Pagina>
}

function Pagina({ children }) {
  return (
    <div className="flex flex-col gap-4 py-4">
      <Titulo>Usuarios</Titulo>
      {children}
    </div>
  )
}

function SinPermiso() {
  return <Vacio icono="lock" titulo="Esta sección es solo para administradores" mensaje="Si necesitás cambiar permisos, pedíselo a un administrador." />
}

function ListaUsuarios({ yoId }) {
  const [carga, setCarga] = useState({ cargando: true })
  const [intento, setIntento] = useState(0)

  const [busqueda, setBusqueda] = useState('')
  const [verSinAcceso, setVerSinAcceso] = useState(false)

  // Lo que está abierto: el panel de permisos, la confirmación de quitar acceso o la de reemplazar al cargador.
  const [panel, setPanel] = useState(null) // { usuario, aprobando }
  const [quitando, setQuitando] = useState(null) // usuario
  const [reemplazo, setReemplazo] = useState(null) // { usuario, datos, cargadorActual, textoListo }
  const [guardando, setGuardando] = useState(false)
  const [errorAccion, setErrorAccion] = useState(null)
  const [aviso, setAviso] = useState(null) // { tipo: 'ok' | 'error', texto }

  useEffect(() => {
    let cancelado = false
    // Usuarios y lugares juntos: el panel necesita los lugares para elegir dónde carga un cargador.
    Promise.all([listarUsuarios(), obtenerLugares()])
      .then(([usuarios, lugares]) => {
        if (!cancelado) setCarga({ usuarios: usuarios.usuarios, lugares: lugares.lugares })
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
    if (aviso?.tipo !== 'ok') return
    const temporizador = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(temporizador)
  }, [aviso])

  function cerrarTodo() {
    setPanel(null)
    setQuitando(null)
    setReemplazo(null)
    setErrorAccion(null)
  }

  // Guarda un cambio. Si el lugar ya tiene otro cargador, el backend responde 409 con cargadorActual
  // y se pide confirmación; al confirmar se reenvía lo mismo con reemplazar = true.
  async function guardar(usuarioEditado, datos, textoListo, reemplazar = false) {
    setGuardando(true)
    setErrorAccion(null)
    try {
      await editarUsuario(usuarioEditado.id, { ...datos, ...(reemplazar && { reemplazarCargador: true }) })
      cerrarTodo()
      setAviso({ tipo: 'ok', texto: textoListo })
      // Se vuelve a pedir la lista sin mostrar "cargando": si hubo reemplazo, también cambió otra persona.
      setIntento((n) => n + 1)
    } catch (err) {
      if (err.estado === 409 && err.datos?.cargadorActual) {
        setReemplazo({ usuario: usuarioEditado, datos, cargadorActual: err.datos.cargadorActual, textoListo })
      } else if (panel || quitando || reemplazo) {
        setErrorAccion(err.message)
      } else {
        setAviso({ tipo: 'error', texto: err.message })
      }
    } finally {
      setGuardando(false)
    }
  }

  // Los datos de una persona tal como están, para cambiar solo si tiene acceso o no.
  const conEstado = (u, estado) => ({ rol: u.rol, lugarId: u.lugar?.id ?? null, estado })

  if (carga.error) {
    // El 403 del backend es lo mismo que no ser administrador.
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
  if (carga.cargando) return <Cargando filas={4} />
  if (carga.usuarios.length === 0) {
    return <Vacio icono="group" titulo="Todavía no hay usuarios" mensaje="Cuando alguien pida acceso, va a aparecer acá para que lo apruebes." />
  }

  const buscado = normalizar(busqueda.trim())
  const visibles = buscado ? carga.usuarios.filter((u) => normalizar(`${u.nombre} ${u.email}`).includes(buscado)) : carga.usuarios
  const esperando = visibles.filter((u) => grupoDe(u) === 'esperando')
  const conAcceso = visibles.filter((u) => grupoDe(u) === 'con-acceso')
  const sinAcceso = visibles.filter((u) => grupoDe(u) === 'sin-acceso')
  // Buscando, el grupo "Sin acceso" se abre solo para no esconder resultados.
  const sinAccesoAbierto = verSinAcceso || Boolean(buscado)

  const tarjetas = (lista) => (
    <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {lista.map((u) => (
        <li key={u.id}>
          <TarjetaUsuario
            usuario={u}
            esYo={u.id === yoId}
            ocupado={guardando}
            onAprobar={(x) => setPanel({ usuario: x, aprobando: true })}
            onCambiar={(x) => setPanel({ usuario: x, aprobando: false })}
            onQuitar={setQuitando}
            onDevolver={(x) => guardar(x, conEstado(x, 'activo'), `Listo, ${x.nombre} ya puede entrar de nuevo.`)}
          />
        </li>
      ))}
    </ul>
  )

  return (
    <>
      {aviso && (
        <p
          role={aviso.tipo === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2 rounded-xl p-3 text-body-md ${aviso.tipo === 'error' ? 'bg-error-fondo text-error-texto' : 'bg-tonal text-bosque'}`}
        >
          <Icono nombre={aviso.tipo === 'error' ? 'error' : 'check_circle'} className="shrink-0" />
          {aviso.texto}
        </p>
      )}

      <CampoTexto etiqueta="Buscá por nombre o email" type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} autoComplete="off" />

      {visibles.length === 0 ? (
        <Vacio icono="search_off" titulo="No encontramos a nadie" mensaje="Revisá lo que escribiste o probá con otro nombre.">
          <Boton variante="secundario" icono="close" onClick={() => setBusqueda('')}>
            Borrar búsqueda
          </Boton>
        </Vacio>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <Titulo nivel="md">Esperando aprobación{esperando.length > 0 && ` (${esperando.length})`}</Titulo>
            {esperando.length > 0 ? (
              <>
                <p className="flex items-start gap-2 rounded-xl bg-pendiente p-3 text-body-md text-pendiente-texto">
                  <Icono nombre="schedule" className="shrink-0" />
                  Estas personas pidieron una cuenta y todavía no pueden entrar. Tocá Aprobar para elegir qué pueden hacer.
                </p>
                {tarjetas(esperando)}
              </>
            ) : (
              <p className="text-body-md text-texto-2">No hay pedidos nuevos.</p>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <Titulo nivel="md">Con acceso ({conAcceso.length})</Titulo>
            {conAcceso.length > 0 ? tarjetas(conAcceso) : <p className="text-body-md text-texto-2">Nadie por ahora.</p>}
          </section>

          {sinAcceso.length > 0 && (
            <section className="flex flex-col gap-3">
              <button
                type="button"
                aria-expanded={sinAccesoAbierto}
                onClick={() => setVerSinAcceso((v) => !v)}
                className="flex min-h-12 items-center justify-between gap-2 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-bosque-hover"
              >
                <Titulo nivel="md">Sin acceso ({sinAcceso.length})</Titulo>
                <Icono nombre={sinAccesoAbierto ? 'expand_less' : 'expand_more'} className="text-texto-2" />
              </button>
              {sinAccesoAbierto && tarjetas(sinAcceso)}
            </section>
          )}
        </>
      )}

      {panel && (
        <PanelPermisos
          key={panel.usuario.id}
          usuario={panel.usuario}
          lugares={carga.lugares}
          aprobando={panel.aprobando}
          guardando={guardando}
          error={errorAccion}
          onCerrar={cerrarTodo}
          onGuardar={(datos) =>
            guardar(
              panel.usuario,
              // Cambiar permisos a alguien sin acceso no se lo devuelve: eso se hace con "Devolver acceso".
              { ...datos, estado: !panel.aprobando && panel.usuario.estado === 'deshabilitado' ? 'deshabilitado' : 'activo' },
              panel.aprobando ? `Listo, ${panel.usuario.nombre} ya puede entrar.` : `Listo, guardamos los cambios de ${datos.nombre}.`,
            )
          }
        />
      )}

      <Modal abierto={Boolean(quitando)} titulo={`¿Quitarle el acceso a ${quitando?.nombre}?`} onCerrar={cerrarTodo}>
        <p className="mb-4 text-body-lg text-texto-2">No va a poder entrar hasta que se lo devuelvas. Sus cargas se conservan.</p>
        {errorAccion && (
          <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl bg-error-fondo p-3 text-body-md text-error-texto">
            <Icono nombre="error" className="shrink-0" />
            {errorAccion}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Boton
            variante="peligro"
            icono="block"
            cargando={guardando}
            textoCargando="Quitando…"
            onClick={() => guardar(quitando, conEstado(quitando, 'deshabilitado'), `Listo, ${quitando.nombre} ya no puede entrar.`)}
          >
            Quitar acceso
          </Boton>
          <Boton variante="secundario" onClick={cerrarTodo}>
            No, volver
          </Boton>
        </div>
      </Modal>

      <Modal abierto={Boolean(reemplazo)} titulo="Este lugar ya tiene quien cargue" onCerrar={() => setReemplazo(null)}>
        <p className="mb-4 text-body-lg text-texto-2">
          {reemplazo?.cargadorActual.nombre} ya carga los datos de este lugar. Si seguís, {reemplazo?.cargadorActual.nombre} pasa a solo ver. ¿Seguimos?
        </p>
        <div className="flex flex-col gap-2">
          <Boton cargando={guardando} textoCargando="Guardando…" onClick={() => guardar(reemplazo.usuario, reemplazo.datos, reemplazo.textoListo, true)}>
            Sí, seguir
          </Boton>
          <Boton variante="secundario" onClick={() => setReemplazo(null)}>
            No, volver
          </Boton>
        </div>
      </Modal>
    </>
  )
}
