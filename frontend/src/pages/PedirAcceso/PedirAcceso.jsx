import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { solicitarAcceso } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import Icono from '../../components/Icono.jsx'
import Titulo from '../../components/Titulo.jsx'

// Pantalla pública (T16): cualquier persona pide una cuenta. No inicia sesión: la cuenta queda
// esperando que un administrador la apruebe y le elija qué puede hacer.
export default function PedirAcceso() {
  const navigate = useNavigate()

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [verContrasena, setVerContrasena] = useState(false)
  const [institucion, setInstitucion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [enviado, setEnviado] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    // El backend también lo valida; acá se avisa antes para no hacer esperar a la persona.
    if (contrasena.length < 8) {
      setError('La contraseña tiene que tener al menos 8 caracteres.')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      await solicitarAcceso({ nombre, email, contrasena, institucion })
      setEnviado(true)
    } catch (err) {
      // err.message ya viene en español: del backend (400, 409) o armado por api.js (0, 500).
      setError(err.message)
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 py-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Icono nombre="check_circle" tamano="grande" className="text-bosque-hover" />
          <Titulo nivel="lg">Listo, tu pedido llegó</Titulo>
          <p className="text-body-lg text-texto-2">
            Un administrador tiene que aprobar tu cuenta antes de que puedas entrar. Cuando lo haga, ingresá con el email y la contraseña que
            elegiste.
          </p>
        </div>
        <Boton onClick={() => navigate('/login')}>Volver a ingresar</Boton>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <Titulo nivel="lg">Pedí acceso a Células de Bosque</Titulo>
        <p className="text-body-lg text-texto-2">Completá tus datos. Un administrador va a revisar tu pedido y te va a habilitar la cuenta.</p>
      </header>

      <form onSubmit={enviar} className="flex flex-col gap-4">
        <CampoTexto
          etiqueta="Nombre y apellido"
          autoComplete="name"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={100}
          required
        />

        <CampoTexto
          etiqueta="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <CampoTexto
                etiqueta="Contraseña"
                type={verContrasena ? 'text' : 'password'}
                autoComplete="new-password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                required
              />
            </div>
            <button
              type="button"
              onClick={() => setVerContrasena((v) => !v)}
              aria-label={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="flex size-12 shrink-0 items-center justify-center rounded-xl text-bosque hover:bg-tonal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque-hover"
            >
              <Icono nombre={verContrasena ? 'visibility_off' : 'visibility'} />
            </button>
          </div>
          <p className="mt-1 text-body-sm text-texto-3">Al menos 8 caracteres.</p>
        </div>

        <div>
          <CampoTexto
            etiqueta="Colegio o institución (opcional)"
            autoComplete="organization"
            value={institucion}
            onChange={(e) => setInstitucion(e.target.value)}
            maxLength={150}
          />
          <p className="mt-1 text-body-sm text-texto-3">¿De qué colegio o institución venís? Ayuda a que te aprueben más rápido.</p>
        </div>

        {error && (
          <p role="alert" className="flex items-center gap-2 rounded-xl bg-error-fondo p-3 text-body-md text-error-texto">
            <Icono nombre="error" />
            {error}
          </p>
        )}

        <Boton type="submit" cargando={enviando} textoCargando="Enviando…">
          Enviar pedido
        </Boton>
      </form>

      <p className="text-center text-body-md text-texto-2">
        ¿Ya tenés cuenta?{' '}
        <Link to="/login" className="font-medium text-bosque underline">
          Ingresá
        </Link>
      </p>
    </main>
  )
}
