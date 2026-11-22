import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { crearCelula, obtenerIsleta } from '../../api.js'
import Boton from '../../components/Boton.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import Cargando from '../../components/Cargando.jsx'
import CodigoCelula from '../../components/CodigoCelula.jsx'
import Icono from '../../components/Icono.jsx'
import MensajeError from '../../components/MensajeError.jsx'
import Plano from '../../components/Plano.jsx'
import Titulo from '../../components/Titulo.jsx'
import Vacio from '../../components/Vacio.jsx'
import { hoyEnCordoba } from '../Carga/fechas.js'
import { celulasConProvisoria, codigoNuevo, errorDeNumero, ID_PROVISORIA, primerNumeroLibre } from './nuevaCelula.js'

// Lado de cada celda del plano: 48 px para que se pueda tocar con el dedo (frontend/CLAUDE.md).
const TAMANO_CELDA = 48

// Paso 2 de Nueva célula: con la isleta ya elegida, la celda en el plano, el número, la fecha de
// plantación, el código grande y el botón para darla de alta (ALT-01 a ALT-06).
// Props:
// - isletaId: la isleta elegida. NuevaCelula le pone key={isletaId}: al cambiar de isleta, este
//   formulario arranca de cero.
// - onTocar(): avisa que la persona eligió o cambió algo (para pedir confirmación al cancelar, ALT-09).
export default function FormularioCelula({ isletaId, onTocar }) {
  const navigate = useNavigate()

  // La isleta: { cargando } | { error } | { isleta }.
  const [carga, setCarga] = useState({ cargando: true })
  const [intento, setIntento] = useState(0) // al cambiarlo, el useEffect vuelve a pedir la isleta

  // Lo que elige la persona.
  const [eleccion, setEleccion] = useState(null) // { fila, columna } o null
  const [numeroTexto, setNumeroTexto] = useState(null) // null hasta que llega la isleta y se sugiere uno
  const [hoy] = useState(hoyEnCordoba) // se calcula una sola vez al abrir
  const [fecha, setFecha] = useState(hoy)

  // Guardado. "enviando" es un ref para cortar un segundo toque en el acto (el estado de React se
  // actualiza recién en el próximo render).
  const [guardando, setGuardando] = useState(false)
  const enviando = useRef(false)
  const [errorServidor, setErrorServidor] = useState(null)

  useEffect(() => {
    let cancelado = false // si se cambia de isleta antes de que llegue la respuesta, no se usa
    obtenerIsleta(isletaId)
      .then((isleta) => {
        if (cancelado) return
        setCarga({ isleta })
        // ALT-01: se sugiere el primer número libre, pero solo la primera vez. Si se vuelve a pedir
        // la isleta (después de un 409), no se pisa el número que eligió la persona.
        setNumeroTexto((actual) => actual ?? String(primerNumeroLibre(isleta.celulas) ?? ''))
      })
      .catch((error) => {
        if (!cancelado) setCarga((anterior) => (anterior.isleta ? anterior : { error }))
      })
    return () => {
      cancelado = true
    }
  }, [isletaId, intento])

  function reintentar() {
    setCarga({ cargando: true })
    setIntento((n) => n + 1)
  }

  if (carga.cargando) return <Cargando filas={3} />
  if (carga.error) return <MensajeError mensaje={carga.error.message} onReintentar={reintentar} />

  const { isleta } = carga
  // El backend decide si se puede crear (auth.PuedeEditarLugar); acá solo se evita mostrar un
  // formulario que después daría 403.
  if (!isleta.puedeEditar) {
    return (
      <Vacio icono="lock" titulo="No podés dar de alta células en este lugar" mensaje="Solo el administrador y el cargador del lugar pueden hacerlo." />
    )
  }

  const celulas = isleta.celulas
  const errorNumero = numeroTexto === null ? null : errorDeNumero(numeroTexto, celulas)
  const numero = errorNumero ? null : Number(numeroTexto)
  const codigo = numero != null ? codigoNuevo(isleta.lugar.letra, isleta.numero, numero) : null
  // Si después de un 409 la celda elegida resultó ocupada, se avisa y hay que elegir otra.
  const celdaOcupada = eleccion != null && celulas.some((c) => c.fila === eleccion.fila && c.columna === eleccion.columna)
  // ALT-04: la fecha no puede ser futura. Las fechas "YYYY-MM-DD" se comparan bien como texto.
  const errorFecha = !fecha ? 'Elegí la fecha de plantación.' : fecha > hoy ? 'La fecha de plantación no puede ser futura.' : null
  const listo = eleccion != null && !celdaOcupada && numero != null && !errorFecha

  function elegirCelda(fila, columna) {
    setEleccion({ fila, columna })
    setErrorServidor(null)
    onTocar()
  }

  async function darDeAlta() {
    if (enviando.current || !listo) return
    enviando.current = true
    setGuardando(true)
    setErrorServidor(null)
    try {
      const creada = await crearCelula({
        isletaId: isleta.id,
        numero,
        fila: eleccion.fila,
        columna: eleccion.columna,
        fechaPlantacion: fecha,
      })
      toast.success(`Célula ${creada.codigo} dada de alta. Ahora cargá su registro inicial.`)
      // ALT-06: sigue con el registro inicial en la pantalla de carga. replace: el botón "atrás"
      // no vuelve a este formulario ya enviado.
      navigate(`/cargar/${creada.id}`, { replace: true })
    } catch (error) {
      // Se muestra el mensaje del servidor y no se borra nada de lo elegido.
      setErrorServidor(error.message)
      enviando.current = false
      setGuardando(false)
      // 409: otra persona ocupó el número o la celda. Se vuelve a pedir la isleta (sin mostrar
      // "cargando") para que el plano y el aviso del número muestren lo que ya está ocupado.
      if (error.estado === 409) setIntento((n) => n + 1)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Celda en el plano (ALT-01). Sin foto de dron se ve solo la grilla, igual que en el lote. */}
      <section className="flex flex-col gap-3">
        <Titulo nivel="sm" como="h2">
          Elegí la celda en el plano
        </Titulo>
        <p className="text-body-md text-texto-2">
          Tocá una celda libre (con borde punteado). La nueva célula se ve en blanco con su número.
        </p>
        <Plano
          filas={isleta.filas}
          columnas={isleta.columnas}
          celulas={celulasConProvisoria(celulas, eleccion, numero, codigo)}
          tamanoCelda={TAMANO_CELDA}
          resaltadaId={ID_PROVISORIA}
          onSeleccionarLibre={elegirCelda}
          imagenUrl={isleta.planoFotoId ? `/api/fotos/${isleta.planoFotoId}` : undefined}
        />
        {eleccion && !celdaOcupada && (
          <p className="text-body-md text-texto-2 tabular-nums">
            Elegiste la fila {eleccion.fila}, columna {eleccion.columna}.
          </p>
        )}
        {celdaOcupada && (
          <p role="alert" className="flex items-center gap-1 text-body-sm text-error">
            <Icono nombre="error" tamano="chip" />
            Esa celda ya está ocupada. Tocá otra celda libre.
          </p>
        )}
      </section>

      {/* Número (sugerido, editable) y fecha de plantación (hoy, nunca futura). */}
      <section className="grid gap-4 sm:max-w-md sm:grid-cols-2">
        <CampoTexto
          etiqueta="Número de célula"
          value={numeroTexto ?? ''}
          onChange={(e) => {
            setNumeroTexto(e.target.value.replace(/\D/g, '')) // solo dígitos
            setErrorServidor(null)
            onTocar()
          }}
          inputMode="numeric"
          maxLength={3}
          error={errorNumero}
          className="tabular-nums"
        />
        <CampoTexto
          etiqueta="Fecha de plantación"
          type="date"
          value={fecha}
          max={hoy}
          onChange={(e) => {
            setFecha(e.target.value)
            onTocar()
          }}
          error={errorFecha}
        />
      </section>

      {/* ALT-03: el código grande antes de confirmar. */}
      {codigo && (
        <section aria-live="polite" className="flex flex-col items-center gap-2 rounded-2xl border border-borde bg-superficie p-4 text-center shadow-nivel-1">
          <p className="text-body-md text-texto-2">La nueva célula va a ser</p>
          <CodigoCelula codigo={codigo} className="px-4 py-1 text-headline-md" />
          <p className="text-body-sm text-texto-3 tabular-nums">
            {eleccion ? `Fila ${eleccion.fila} · Columna ${eleccion.columna}` : 'Falta elegir la celda en el plano'}
          </p>
        </section>
      )}

      {errorServidor && (
        <p role="alert" className="flex items-start gap-2 rounded-2xl bg-error-fondo p-4 text-body-md font-medium text-error-texto">
          <Icono nombre="error" tamano="chico" className="mt-0.5" />
          {errorServidor}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Boton icono="add" cargando={guardando} textoCargando="Dando de alta…" disabled={!listo} onClick={darDeAlta}>
          {codigo ? `Dar de alta la célula ${codigo}` : 'Dar de alta la célula'}
        </Boton>
        {!eleccion && <p className="text-body-sm text-texto-2">Para seguir, tocá una celda libre en el plano.</p>}
      </div>
    </div>
  )
}
