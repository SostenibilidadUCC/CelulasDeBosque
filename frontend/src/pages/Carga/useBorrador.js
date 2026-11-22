import { useCallback, useEffect, useRef, useState } from 'react'
import {
  armarBorrador,
  borrarBorrador,
  guardarBorrador,
  huboCambios,
  leerBorrador,
  limpiarBorradoresViejos,
} from './borrador.js'

// Cuánto se espera después del último cambio para guardar el borrador. Así no se escribe en
// localStorage en cada tecla de las observaciones, sino cuando la persona hace una pausa.
const ESPERA_MS = 800

// Borrador de la carga mensual en el celular (T17, CAR-16). La lógica de localStorage está en borrador.js.
// Parámetros:
// - activo: false si no hay que usar borrador (por ejemplo, editando un registro ya guardado, CAR-14).
// - usuarioId, celulaId, periodo: de quién, de qué célula y de qué mes es el borrador.
// - datos: lo cargado ahora { fecha, individuos, observaciones, fotoId }.
// - iniciales: lo precargado al abrir, con la misma forma. Si datos es igual a iniciales, no hay borrador.
// Devuelve:
// - borradorPendiente: el borrador encontrado al abrir, mientras la persona no eligió qué hacer (o null).
// - retomar(): devuelve el borrador para cargarlo en el formulario y deja de ofrecerlo.
// - empezarDeNuevo(): borra el borrador; los cambios que vengan se guardan en uno nuevo.
// - guardarYa(): guarda en el acto, sin esperar (por ejemplo, cuando vence la sesión).
// - terminar(): borra el borrador y no guarda más (el registro ya está en el servidor).
export function useBorrador({ activo, usuarioId, celulaId, periodo, datos, iniciales }) {
  const donde = { usuarioId, celulaId, periodo }

  // Con una función, useState lee localStorage una sola vez, al abrir la pantalla.
  const [borradorPendiente, setBorradorPendiente] = useState(() => (activo ? leerBorrador(donde) : null))

  // Refs: valores que cambian sin redibujar la pantalla. Los usa el guardado al salir, que corre
  // cuando el componente ya se está yendo y necesita lo último que se cargó.
  const ultimo = useRef(null)
  const pendiente = useRef(borradorPendiente != null) // mientras se ofrece, no se guarda ni se borra nada
  const terminado = useRef(false) // después de guardar en el servidor, no se vuelve a escribir
  const temporizador = useRef(null)

  // Se actualiza después de cada render (React no deja escribir refs mientras dibuja).
  // Va antes que los otros efectos, así ellos ya ven lo último.
  useEffect(() => {
    ultimo.current = { activo, donde: { usuarioId, celulaId, periodo }, datos, iniciales }
  })

  // Escribe (o borra) el borrador con lo último cargado. Si lo cargado volvió a ser igual a lo
  // precargado, se borra: no hay nada que retomar.
  const escribir = useCallback(() => {
    clearTimeout(temporizador.current)
    if (!ultimo.current) return
    const { activo, donde, datos, iniciales } = ultimo.current
    if (!activo || pendiente.current || terminado.current) return
    if (huboCambios(datos, iniciales)) guardarBorrador(donde, armarBorrador({ ...datos, periodo: donde.periodo }))
    else borrarBorrador(donde)
  }, [])

  // Al abrir: se limpian los borradores de meses anteriores de esta persona.
  useEffect(() => {
    if (activo) limpiarBorradoresViejos(usuarioId, periodo)
  }, [activo, usuarioId, periodo]) // no cambian mientras la pantalla está abierta: corre una vez

  // Después de cada cambio se reinicia la espera ("debounce"): se guarda recién cuando pasan
  // ESPERA_MS sin cambios. JSON.stringify(datos) como dependencia: el efecto corre solo si
  // cambió algún valor, no cada vez que se redibuja la pantalla.
  const textoDatos = JSON.stringify(datos)
  useEffect(() => {
    if (!activo) return
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(escribir, ESPERA_MS)
  }, [activo, textoDatos, escribir])

  // Al salir de la pantalla (cambiar de célula, ir a otra sección o vencer la sesión) se guarda
  // en el acto lo que estaba esperando, para no perder los últimos cambios.
  useEffect(() => escribir, [escribir])

  function retomar() {
    const borrador = borradorPendiente
    pendiente.current = false
    setBorradorPendiente(null)
    return borrador
  }

  function empezarDeNuevo() {
    borrarBorrador(donde)
    pendiente.current = false
    setBorradorPendiente(null)
  }

  function terminar() {
    clearTimeout(temporizador.current)
    terminado.current = true
    borrarBorrador(donde)
  }

  return { borradorPendiente, retomar, empezarDeNuevo, guardarYa: escribir, terminar }
}
