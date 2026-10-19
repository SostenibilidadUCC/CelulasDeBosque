// Arma el cuerpo de POST /api/celulas/{id}/registros y de PUT /api/registros/{id} (T14).
// Es una función pura: recibe el estado del formulario y devuelve el objeto que se manda, sin
// tocar nada más. Se usa recién después de esFormularioValido (validacion.js).
import { observacionesParaGuardar } from './validacion.js'

// Un individuo con la forma que espera el backend (RN-08):
// - vivo: exactamente sus 6 campos, los números como números y los sí/no como booleanos;
// - muerto: solo { formaDeVida, vivo: false }, aunque en el estado quedara algún dato viejo.
// Number() convierte "120" en 120, por si algún control devolviera el valor como texto.
function individuoParaGuardar(individuo) {
  const formaDeVida = Number(individuo.formaDeVida)
  if (individuo.vivo !== true) return { formaDeVida, vivo: false }
  return {
    formaDeVida,
    vivo: true,
    alturaCm: Number(individuo.alturaCm),
    flores: Number(individuo.flores),
    frutos: individuo.frutos === true,
    plantulasNuevas: individuo.plantulasNuevas === true,
  }
}

// { fecha, fotoId, observaciones, individuos } del formulario → el cuerpo del pedido.
// Las observaciones van sin espacios en los costados; vacías o de solo espacios, null.
// No se manda ningún campo de más.
export function armarPedido({ fecha, fotoId, observaciones, individuos }) {
  return {
    fecha,
    fotoId: Number(fotoId),
    observaciones: observacionesParaGuardar(observaciones),
    individuos: individuos.map(individuoParaGuardar),
  }
}
