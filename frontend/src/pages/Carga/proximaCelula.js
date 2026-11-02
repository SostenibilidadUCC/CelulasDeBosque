// Busca la próxima célula para cargar en un lugar y devuelve su id, o null si no queda ninguna.
// Primero la primera pendiente (el backend las ordena por isleta y número); si no hay,
// la primera sin registro inicial, que también hay que cargar.
// "pedirCelulas" es obtenerCelulasDeLugar de api.js; se recibe por parámetro para poder probarla sin backend.
export async function buscarProximaCelula(lugarId, pedirCelulas) {
  for (const estado of ['pendiente', 'sin-registro']) {
    const { celulas } = await pedirCelulas(lugarId, { estado })
    if (celulas.length > 0) return celulas[0].id
  }
  return null
}
