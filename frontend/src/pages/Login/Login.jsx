import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { iniciarSesion } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import Icono from '../../components/Icono.jsx'
import Tarjeta from '../../components/Tarjeta.jsx'
import Titulo from '../../components/Titulo.jsx'
import { useSesion } from '../../sesion/useSesion.js'

export default function Login() {
  const { usuario, setUsuario } = useSesion()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [verContrasena, setVerContrasena] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  // Si ya hay sesión, vuelve a la pantalla a la que quería entrar (la guarda RutaPrivada en "desde").
  // Es el único lugar que navega después del login: si también navegara enviar(), los dos podrían pisarse.
  if (usuario) return <Navigate to={location.state?.desde ?? '/inicio'} replace />

  async function enviar(e) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      const datos = await iniciarSesion(email, contrasena)
      // Al guardar el usuario, el componente se vuelve a dibujar y el <Navigate> de arriba lo lleva.
      setUsuario(datos)
    } catch (err) {
      // err.message ya viene en español: del backend (400, 401, 403) o armado por api.js (0, 500).
      setError(err.message)
      setEnviando(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <header className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-bosque text-white shadow-nivel-2">
          <Icono nombre="park" tamano="grande" relleno />
        </span>
        <div className="flex flex-col gap-2">
          <Titulo nivel="lg">Células de Bosque</Titulo>
          <p className="text-body-lg text-texto-2">
            UCC Sostenible registra mes a mes cómo crecen las células de bosque del Campus y de los colegios.
          </p>
        </div>
      </header>

      <Tarjeta className="p-5 sm:p-6">
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <h2 className="text-headline-sm font-semibold text-texto">Ingresá con tu cuenta</h2>
          <CampoTexto
            etiqueta="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <CampoTexto
                etiqueta="Contraseña"
                type={verContrasena ? 'text' : 'password'}
                autoComplete="current-password"
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

          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-xl bg-error-fondo p-3 text-body-md text-error-texto">
              <Icono nombre="error" />
              {error}
            </p>
          )}

          <Boton type="submit" cargando={enviando} textoCargando="Ingresando…">
            Ingresar
          </Boton>
        </form>
      </Tarjeta>

      <Boton variante="texto" icono="arrow_back" onClick={() => navigate('/')}>
        Volver a la presentación
      </Boton>
    </main>
  )
}
