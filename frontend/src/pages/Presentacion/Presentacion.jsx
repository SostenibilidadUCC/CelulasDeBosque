import { useNavigate } from 'react-router'
import Acordeon from '../../components/Acordeon.jsx'
import Boton from '../../components/Boton.jsx'
import Icono from '../../components/Icono.jsx'
import { BlurFade } from '../../components/ui/blur-fade.jsx'
import { useSesion } from '../../sesion/useSesion.js'

// Página de presentación (ruta "/"): lo primero que ve cualquier persona, con o sin sesión.
// Explica qué es una célula de bosque y cómo se sigue su crecimiento, y lleva a los resultados
// públicos del Campus UCC o al login. Los textos salen de https://ucc.edu.ar/celulas-de-bosques,
// adaptados al vocabulario de la app (Gramínea y Rastrera, sin siglas).
// Las fotos son de la galería de esa página, optimizadas en public/presentacion.

const formasDeVida = [
  { nombre: 'Árbol', icono: 'park', color: 'bg-arbol' },
  { nombre: 'Arbusto', icono: 'nature', color: 'bg-arbusto' },
  { nombre: 'Gramínea', icono: 'local_florist', color: 'bg-graminea' },
  { nombre: 'Rastrera', icono: 'grass', color: 'bg-rastrera' },
]

// Es una secuencia real (se hace en este orden), por eso va numerada.
// El código A‑1‑45 usa guiones que no se cortan (U+2011), para que no quede "A-" en una línea.
const pasos = [
  {
    icono: 'flight',
    titulo: 'Ubicamos cada célula',
    texto: 'Cada célula tiene un código, como A‑1‑45, y su lugar marcado en el plano de la isleta, hecho con una foto de dron.',
  },
  {
    icono: 'photo_camera',
    titulo: 'La fotografiamos y medimos cada mes',
    texto: 'Una foto desde arriba y, para cada planta, si está viva, cuánto mide, si tiene flores o frutos y si aparecieron plántulas nuevas.',
  },
  {
    icono: 'insights',
    titulo: 'Compartimos los resultados',
    texto: 'Los resultados se publican para que cualquier persona los vea, escaneando el QR del lugar o desde esta página.',
  },
]

const atributos = [
  {
    icono: 'diversity_2',
    titulo: 'Biodiversidad',
    texto: 'No es un solo individuo: reúne los primeros integrantes de una comunidad del bosque nativo.',
  },
  {
    icono: 'autorenew',
    titulo: 'Regenera',
    texto: 'Se usa para restaurar ecosistemas degradados, en la ciudad y en el campo.',
  },
  {
    icono: 'recycling',
    titulo: 'Biodegradable',
    texto: 'El contenedor no tiene plásticos: se planta entero y desaparece en el suelo.',
  },
]

const preguntas = [
  {
    pregunta: '¿Varias plantas en un solo contenedor no compiten entre ellas?',
    respuesta:
      'Las raíces no compiten: trabajan juntas y crean un pequeño ecosistema que restaura suelos, regenera paisajes y multiplica la vida.',
  },
  {
    pregunta: '¿Por qué es mejor que plantar un árbol solo?',
    respuesta:
      'Porque se planta un sistema vivo que ya funciona, con más posibilidades de sobrevivir que una planta aislada.',
  },
  {
    pregunta: '¿Dónde se plantan?',
    respuesta:
      'En la ciudad suman infraestructura verde, como plazas y parques. En el campo ayudan a recuperar ecosistemas degradados.',
  },
  {
    pregunta: '¿Quién hace el seguimiento?',
    respuesta:
      'El equipo de UCC Sostenible y las personas de cada colegio adherido, que cargan los registros desde el celular.',
  },
]

export default function Presentacion() {
  const navigate = useNavigate()
  const { usuario } = useSesion()
  const verResultados = () => navigate('/publico/A')

  return (
    <div className="min-h-svh bg-fondo">
      {/* Portada: foto real de la plantación a todo el ancho, con un velo verde para que el texto
          blanco se lea bien (también al sol). Es lo único que se mueve: entra suave una vez. */}
      <header className="relative isolate flex min-h-[620px] flex-col overflow-hidden bg-bosque text-white sm:min-h-[680px]">
        <img
          src="/presentacion/portada.webp"
          alt=""
          width={2000}
          height={835}
          fetchPriority="high"
          className="absolute inset-0 -z-10 size-full object-cover object-[60%_center]"
        />
        <div className="absolute inset-0 -z-10 bg-linear-to-t from-bosque via-bosque/80 to-bosque/30 lg:bg-linear-to-r lg:via-bosque/70 lg:to-transparent" />

        <BarraPresentacion
          usuario={usuario}
          onIngresar={() => navigate(usuario ? '/inicio' : '/login')}
        />

        <div className="mx-auto flex w-full max-w-[1120px] flex-1 items-end px-4 pt-10 pb-14 sm:px-6 lg:items-center lg:px-10">
          <BlurFade className="flex max-w-xl flex-col gap-5">
            <h1 className="font-titulo text-[40px]/[46px] font-bold tracking-[-0.02em] text-balance sm:text-[56px]/[62px]">
              Seguimos mes a mes cómo crece el bosque
            </h1>
            <p className="max-w-[52ch] text-[18px]/[28px] text-white/90">
              Registramos el crecimiento y la supervivencia de las células de bosque plantadas en el Campus UCC y en
              colegios de Córdoba. Cualquier persona puede ver los resultados.
            </p>
            <Boton
              icono="eco"
              className="w-full bg-superficie text-bosque shadow-nivel-2 hover:bg-brote sm:w-auto sm:self-start"
              onClick={verResultados}
            >
              Ver cómo crecen
            </Boton>
          </BlurFade>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1120px] flex-col gap-20 px-4 py-16 sm:px-6 lg:gap-28 lg:px-10 lg:py-24">
        {/* Qué es una célula de bosque */}
        <section aria-labelledby="que-es" className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
          <img
            src="/presentacion/celula.webp"
            alt="Una célula de bosque recién plantada en el campo, con sus plantas y tutores de madera"
            width={1200}
            height={675}
            loading="lazy"
            className="aspect-[4/3] w-full rounded-2xl object-cover shadow-nivel-2"
          />
          <div className="flex flex-col gap-5">
            <h2 id="que-es" className="font-titulo text-[30px]/[38px] font-semibold tracking-[-0.01em] text-bosque sm:text-[36px]/[44px]">
              ¿Qué es una célula de bosque?
            </h2>
            <p className="max-w-[60ch] text-body-lg text-texto-2">
              Es un contenedor biodegradable que se planta entero, con cuatro plantas nativas adentro. Juntas forman un
              pequeño núcleo de bosque que ayuda a restaurar el suelo y a sumar biodiversidad frente al cambio climático.
            </p>
            <blockquote className="border-l-4 border-hoja pl-4 font-titulo text-[22px]/[30px] font-semibold text-bosque">
              Las raíces no compiten, colaboran.
            </blockquote>
            <div className="flex flex-col gap-3">
              <p className="text-label-lg font-medium text-texto">Cada célula reúne cuatro formas de vida:</p>
              <ul className="grid grid-cols-2 gap-3">
                {formasDeVida.map((f) => (
                  <li
                    key={f.nombre}
                    className="flex min-h-14 items-center gap-3 rounded-xl border border-borde bg-superficie px-4 py-3 shadow-nivel-1"
                  >
                    <span className={`flex size-9 shrink-0 items-center justify-center rounded-full text-white ${f.color}`}>
                      <Icono nombre={f.icono} tamano="chico" />
                    </span>
                    <span className="text-label-lg font-medium text-texto">{f.nombre}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Cómo hacemos el seguimiento: el foco de la app */}
        <section aria-labelledby="seguimiento" className="flex flex-col gap-10">
          <div className="flex max-w-2xl flex-col gap-3">
            <h2 id="seguimiento" className="font-titulo text-[30px]/[38px] font-semibold tracking-[-0.01em] text-bosque sm:text-[36px]/[44px]">
              Cómo seguimos su crecimiento
            </h2>
            <p className="text-body-lg text-texto-2">
              Todos los meses visitamos cada célula y registramos cómo está. Así sabemos cuántas plantas sobreviven y
              cuánto crecen desde el día de la plantación.
            </p>
          </div>

          <ol className="grid gap-4 md:grid-cols-3">
            {pasos.map((paso, i) => (
              <li key={paso.titulo} className="flex flex-col gap-4 rounded-2xl border border-borde bg-superficie p-5 shadow-nivel-1 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-bosque font-titulo text-headline-md font-bold text-white">
                    {i + 1}
                  </span>
                  <Icono nombre={paso.icono} className="text-bosque-hover" />
                </div>
                <h3 className="text-headline-sm font-semibold text-texto">{paso.titulo}</h3>
                <p className="text-body-md text-texto-2">{paso.texto}</p>
              </li>
            ))}
          </ol>

          {/* Fotos de la plantación: una grande y dos chicas. */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
            <img
              src="/presentacion/hilera.webp"
              alt="Hilera de células de bosque plantadas en el campo"
              width={1200}
              height={675}
              loading="lazy"
              className="col-span-2 aspect-[16/9] w-full rounded-2xl object-cover lg:col-span-1 lg:aspect-[4/3]"
            />
            <img
              src="/presentacion/celulas-cerca.webp"
              alt="Células de bosque vistas de cerca, con sus tutores y las plantas creciendo"
              width={1200}
              height={675}
              loading="lazy"
              className="aspect-[4/3] w-full rounded-2xl object-cover"
            />
            <img
              src="/presentacion/plantas.webp"
              alt="Plantas nativas creciendo dentro de una célula de bosque"
              width={1200}
              height={675}
              loading="lazy"
              className="aspect-[4/3] w-full rounded-2xl object-cover"
            />
          </div>
        </section>

        {/* Por qué una célula de bosque */}
        <section aria-labelledby="por-que" className="flex flex-col gap-8">
          <h2 id="por-que" className="font-titulo text-[30px]/[38px] font-semibold tracking-[-0.01em] text-bosque sm:text-[36px]/[44px]">
            Por qué una célula y no un árbol solo
          </h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {atributos.map((a) => (
              <li key={a.titulo} className="flex flex-col gap-3 rounded-2xl bg-tonal p-5 sm:p-6">
                <span className="flex size-12 items-center justify-center rounded-full bg-superficie text-bosque shadow-nivel-1">
                  <Icono nombre={a.icono} />
                </span>
                <h3 className="text-headline-sm font-semibold text-bosque">{a.titulo}</h3>
                <p className="text-body-md text-texto-2">{a.texto}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Preguntas frecuentes */}
        <section aria-labelledby="preguntas" className="flex flex-col gap-6">
          <h2 id="preguntas" className="font-titulo text-[30px]/[38px] font-semibold tracking-[-0.01em] text-bosque sm:text-[36px]/[44px]">
            Preguntas frecuentes
          </h2>
          <Acordeon items={preguntas} />
        </section>
      </main>

      <footer className="border-t border-borde bg-superficie">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-3 px-4 py-8 text-body-md text-texto-2 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <p>UCC Sostenible · Universidad Católica de Córdoba</p>
          <a
            href="https://ucc.edu.ar/celulas-de-bosques"
            target="_blank"
            rel="noreferrer"
            className="flex min-h-12 items-center gap-1 font-medium text-bosque underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque-hover"
          >
            Conocé más del proyecto
            <Icono nombre="open_in_new" tamano="chico" />
            <span className="sr-only">(se abre en otra pestaña)</span>
          </a>
        </div>
      </footer>
    </div>
  )
}

// Barra de arriba de la presentación: la marca y un solo botón para entrar.
// Con sesión iniciada, el botón lleva directo al inicio de cada rol.
function BarraPresentacion({ usuario, onIngresar }) {
  return (
    <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-10">
      <span className="flex items-center gap-2">
        <span className="flex size-10 items-center justify-center rounded-full bg-superficie text-bosque">
          <Icono nombre="park" relleno />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="font-titulo text-headline-sm font-semibold">Células de Bosque</span>
          <span className="text-body-sm text-white/80">UCC Sostenible</span>
        </span>
      </span>
      <Boton
        variante="secundario"
        icono={usuario ? 'home' : 'login'}
        className="w-auto border-white/70 bg-transparent text-white hover:border-white hover:bg-white/15"
        onClick={onIngresar}
      >
        {usuario ? 'Ir a mi inicio' : 'Ingresar'}
      </Boton>
    </div>
  )
}
