// Estado de los 4 individuos de la carga mensual (T14). Cada individuo tiene la forma que espera
// el backend: { formaDeVida, vivo, alturaCm, flores, frutos, plantulasNuevas }.
// Un muerto es solo { formaDeVida, vivo: false } (RN-08). "vivo: null" quiere decir "sin elegir".

// Rangos de altura y flores. Son los mismos del catálogo "variables" (migración 00002), pero el
// endpoint de la carga no manda el catálogo, así que se repiten acá, en un solo lugar.
// Si la clienta los cambia, hay que cambiarlos en la migración nueva y acá.
export const ALTURA_MIN = 1
export const ALTURA_MAX = 999
export const FLORES_MIN = 0
export const FLORES_MAX = 100

// Un individuo vivo con los valores iniciales: la altura que se le pase (la del mes anterior, o
// null si no hay, y entonces es obligatoria), 0 flores, sin frutos y sin plántulas nuevas.
export function individuoNuevo(formaDeVida, alturaCm = null) {
  return { formaDeVida, vivo: true, alturaCm, flores: 0, frutos: false, plantulasNuevas: false }
}

export function individuoMuerto(formaDeVida) {
  return { formaDeVida, vivo: false }
}

export function individuoSinElegir(formaDeVida) {
  return { formaDeVida, vivo: null }
}

// El individuo de esa forma de vida dentro de un registro (actual o anterior), o undefined.
function buscar(registro, formaDeVida) {
  return registro?.individuos.find((i) => i.formaDeVida === formaDeVida)
}

// La altura del mes anterior, o null si no hay registro anterior o el individuo estaba muerto.
export function alturaAnterior(anterior, formaDeVida) {
  return buscar(anterior, formaDeVida)?.alturaCm ?? null
}

// Si en el registro anterior el individuo figuraba muerto. Solo en ese caso aparece la reposición.
export function estabaMuerto(anterior, formaDeVida) {
  return buscar(anterior, formaDeVida)?.vivo === false
}

// Los 4 individuos con los que arranca el formulario, en el orden de formasDeVida (1 a 4).
// - Editando (hay "actual"): lo que ya está guardado.
// - Registro nuevo: según "anterior". Muerto ahí → arranca muerto (RN-09, con el botón de
//   reposición). Vivo o sin anterior → arranca vivo con la altura anterior.
// - Si "vivo" viene null (falta la medición), arranca sin elegir: nunca se inventa un muerto.
export function individuosIniciales({ formasDeVida, actual, anterior }) {
  return formasDeVida.map(({ formaDeVida }) => {
    if (actual) {
      const guardado = buscar(actual, formaDeVida)
      if (guardado?.vivo === true) {
        return {
          formaDeVida,
          vivo: true,
          alturaCm: guardado.alturaCm ?? null,
          flores: guardado.flores ?? null,
          frutos: guardado.frutos ?? null,
          plantulasNuevas: guardado.plantulasNuevas ?? null,
        }
      }
      if (guardado?.vivo === false) return individuoMuerto(formaDeVida)
      return individuoSinElegir(formaDeVida)
    }

    const previo = buscar(anterior, formaDeVida)
    if (previo?.vivo === false) return individuoMuerto(formaDeVida)
    if (previo && previo.vivo == null) return individuoSinElegir(formaDeVida)
    return individuoNuevo(formaDeVida, alturaAnterior(anterior, formaDeVida))
  })
}
