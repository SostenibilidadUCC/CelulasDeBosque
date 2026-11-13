// Funciones del lote de células (T20, LUG-07). No tocan la pantalla: por eso se pueden probar con node --test.

// Número que se sugiere para la primera célula del lote: el más alto de la isleta más uno.
// Cuentan también las dadas de baja: su número sigue ocupado (RN-02).
export function siguienteNumeroCelula(celulas) {
  return celulas.reduce((maximo, c) => Math.max(maximo, c.numero), 0) + 1
}

// Junta las células que ya están con las de la vista previa, para dibujarlas en el Plano.
// Las nuevas van sin estado (el Plano las pinta blancas, distintas de las existentes) y con un
// id de texto que no choca con los ids numéricos de la base.
export function celulasConLote(existentes, lote) {
  return [...existentes, ...lote.map((c) => ({ id: `nueva-${c.numero}`, ...c }))]
}

// "3 células: de Z-1-3 a Z-1-5", o "1 célula: Z-1-9".
export function resumenDelLote(lote) {
  if (lote.length === 1) return `1 célula: ${lote[0].codigo}`
  return `${lote.length} células: de ${lote[0].codigo} a ${lote[lote.length - 1].codigo}`
}
