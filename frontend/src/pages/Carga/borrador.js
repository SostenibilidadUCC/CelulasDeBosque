// Borrador de la carga mensual en el celular (T17, CAR-16). Funciones puras más el acceso a localStorage.
// Si se corta la conexión, se cierra la app o vence la sesión, lo cargado queda guardado acá y al
// volver a abrir la célula se ofrece retomarlo.
//
// - Un borrador por usuario, célula y período: dos personas en el mismo celular no se mezclan.
// - Se guarda solo el id de la foto si ya se subió: la imagen no entra en localStorage (unos 5 MB).
// - Todo acceso a localStorage va en try/catch: en modo privado o con el almacenamiento lleno puede
//   fallar, y en ese caso la carga sigue funcionando, solo que sin borrador.
// - Cada función recibe "almacen" (opcional) para poder probarla con un almacén falso en los tests.
//   En la app no se pasa y se usa el localStorage del navegador.

const PREFIJO = 'borrador-carga'

// borrador-carga:<usuario>:<célula>:<período>, por ejemplo "borrador-carga:7:45:2026-11".
export function claveDeBorrador(usuarioId, celulaId, periodo) {
  return `${PREFIJO}:${usuarioId}:${celulaId}:${periodo}`
}

// El localStorage del navegador. Se pide recién adentro de cada try: en algunos navegadores
// el solo hecho de leer "localStorage" ya tira un error.
function almacenDelNavegador() {
  return globalThis.localStorage
}

// Solo lo que hace falta para rearmar el formulario. fotoId es null si la foto no terminó de subir.
export function armarBorrador({ periodo, fecha, individuos, observaciones, fotoId }) {
  return { periodo, fecha, individuos, observaciones, fotoId: fotoId ?? null }
}

// true si lo cargado es distinto de lo precargado al abrir la pantalla. Un formulario abierto y
// sin tocar no genera borrador. Se compara con JSON.stringify: los dos objetos se arman siempre con
// las claves en el mismo orden (armarBorrador e individuos.js), así que el texto sale igual si los
// valores son iguales.
export function huboCambios(actual, iniciales) {
  const contenido = (b) => JSON.stringify(armarBorrador({ ...b, periodo: null }))
  return contenido(actual) !== contenido(iniciales)
}

// Revisa que lo leído tenga la forma esperada y sea del período pedido. Un borrador de un mes
// anterior no se ofrece: ese mes ya pasó.
export function borradorValido(borrador, periodo) {
  return (
    borrador != null &&
    typeof borrador === 'object' &&
    borrador.periodo === periodo &&
    typeof borrador.fecha === 'string' &&
    typeof borrador.observaciones === 'string' &&
    (borrador.fotoId === null || typeof borrador.fotoId === 'number') &&
    Array.isArray(borrador.individuos) &&
    borrador.individuos.length === 4 &&
    borrador.individuos.every((i) => i != null && typeof i === 'object' && i.formaDeVida != null)
  )
}

// El borrador guardado, o null si no hay, está roto, es de otro período o localStorage falla.
export function leerBorrador({ usuarioId, celulaId, periodo }, almacen) {
  try {
    const texto = (almacen ?? almacenDelNavegador()).getItem(claveDeBorrador(usuarioId, celulaId, periodo))
    if (!texto) return null
    const borrador = JSON.parse(texto) // si el texto está roto, JSON.parse tira un error y cae en el catch
    return borradorValido(borrador, periodo) ? borrador : null
  } catch {
    return null
  }
}

// Guarda el borrador. Devuelve true si se pudo (false si localStorage falla o está lleno).
export function guardarBorrador({ usuarioId, celulaId }, borrador, almacen) {
  try {
    const clave = claveDeBorrador(usuarioId, celulaId, borrador.periodo)
    ;(almacen ?? almacenDelNavegador()).setItem(clave, JSON.stringify(borrador))
    return true
  } catch {
    return false
  }
}

export function borrarBorrador({ usuarioId, celulaId, periodo }, almacen) {
  try {
    ;(almacen ?? almacenDelNavegador()).removeItem(claveDeBorrador(usuarioId, celulaId, periodo))
  } catch {
    // Si no se puede borrar, no pasa nada: al mes siguiente lo limpia limpiarBorradoresViejos.
  }
}

// Borra los borradores de este usuario de meses anteriores, para que no se acumulen en el celular.
// Los períodos "2026-10" se pueden comparar como texto: "2026-10" < "2026-11".
export function limpiarBorradoresViejos(usuarioId, periodoActual, almacen) {
  try {
    const a = almacen ?? almacenDelNavegador()
    const inicio = `${PREFIJO}:${usuarioId}:`
    const viejas = []
    // Primero se juntan las claves y después se borran: borrar mientras se recorre corre los índices.
    for (let i = 0; i < a.length; i++) {
      const clave = a.key(i)
      if (clave?.startsWith(inicio) && clave.split(':')[3] < periodoActual) viejas.push(clave)
    }
    viejas.forEach((clave) => a.removeItem(clave))
  } catch {
    // Sin localStorage no hay nada que limpiar.
  }
}
