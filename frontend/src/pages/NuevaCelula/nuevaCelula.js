// Funciones de la pantalla Nueva célula (T17, ALT-01 a ALT-04). No tocan la pantalla: por eso se
// pueden probar con node --test.

// Rango del número de célula dentro de la isleta (tabla de dominio de los requerimientos v6).
// Es el mismo que valida el backend (alta_celula.go).
export const NUMERO_MINIMO = 1
export const NUMERO_MAXIMO = 200

// id de la célula provisoria en el Plano. Es texto, así nunca choca con los ids numéricos de la base.
export const ID_PROVISORIA = 'nueva'

// El primer número libre de la isleta, del 1 al 200: si están la 1, la 2 y la 4, sugiere la 3.
// Cuentan también las dadas de baja: su número sigue ocupado (RN-02). GET /api/isletas/{id} las trae.
// Devuelve null si están todos usados.
export function primerNumeroLibre(celulas) {
  // Un Set es una lista sin repetidos que responde rápido "¿está este número?".
  const usados = new Set(celulas.map((c) => c.numero))
  for (let n = NUMERO_MINIMO; n <= NUMERO_MAXIMO; n++) {
    if (!usados.has(n)) return n
  }
  return null
}

// Si el número ya lo tiene otra célula de la isleta (ALT-02).
export function numeroUsado(celulas, numero) {
  return celulas.some((c) => c.numero === numero)
}

// Revisa el número que se escribió y devuelve el mensaje de error, o null si está bien.
// - texto: lo que hay en el campo (siempre texto, aunque sean dígitos).
// - celulas: las de la isleta, para avisar si ya está usado antes de confirmar (ALT-02).
export function errorDeNumero(texto, celulas) {
  if (texto.trim() === '') return 'Escribí el número de la célula.'
  const numero = Number(texto)
  if (!Number.isInteger(numero) || numero < NUMERO_MINIMO || numero > NUMERO_MAXIMO) {
    return `El número tiene que ser de ${NUMERO_MINIMO} a ${NUMERO_MAXIMO}.`
  }
  if (numeroUsado(celulas, numero)) return `Ya hay una célula con el número ${numero} en esta isleta. Elegí otro.`
  return null
}

// Código de célula: "A-1-61" (Lugar-Isleta-Número). No se guarda: se arma desde la jerarquía.
export function codigoNuevo(letra, numeroIsleta, numero) {
  return `${letra}-${numeroIsleta}-${numero}`
}

// Las células de la isleta más la provisoria (la que se va a crear), para dibujarlas en el Plano.
// Va sin estado: el Plano la pinta blanca, distinta de las existentes (igual que celulasConLote).
// - eleccion: { fila, columna } o null si todavía no se tocó ninguna celda.
// - numero: el número elegido, o null si el campo no es válido (la celda se marca igual, sin número).
export function celulasConProvisoria(celulas, eleccion, numero, codigo) {
  if (!eleccion) return celulas
  return [
    ...celulas,
    { id: ID_PROVISORIA, numero: numero ?? '', codigo: codigo ?? 'nueva', fila: eleccion.fila, columna: eleccion.columna },
  ]
}
