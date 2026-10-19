// Tests de alturasSinCambio (T14, CAR-08) y de que el aviso de altura no cuenta como error.
// Se corren con "npm test" (node --test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { individuoMuerto, individuoNuevo } from './individuos.js'
import { alturasSinCambio, errorDeFoto, errorDeIndividuoConCampo, esFormularioValido } from './validacion.js'

test('errorDeIndividuoConCampo: dice qué campo tiene el error', () => {
  assert.equal(errorDeIndividuoConCampo({ formaDeVida: 1, vivo: null }).campo, 'vivo')
  assert.equal(errorDeIndividuoConCampo(individuoNuevo(1, null)).campo, 'alturaCm')
  assert.equal(errorDeIndividuoConCampo({ ...individuoNuevo(1, 80), flores: null }).campo, 'flores')
  assert.equal(errorDeIndividuoConCampo(individuoNuevo(1, 80)), null)
  assert.equal(errorDeIndividuoConCampo(individuoMuerto(1)), null)
})

const anterior = {
  periodo: '2026-09',
  individuos: [
    { formaDeVida: 1, vivo: true, alturaCm: 80, flores: 0, frutos: false, plantulasNuevas: false },
    { formaDeVida: 2, vivo: true, alturaCm: 59, flores: 6, frutos: true, plantulasNuevas: false },
    { formaDeVida: 3, vivo: false },
    { formaDeVida: 4, vivo: true, alturaCm: 14, flores: 8, frutos: false, plantulasNuevas: false },
  ],
}

test('alturasSinCambio: devuelve las formas de vida vivas con la misma altura que antes', () => {
  const individuos = [individuoNuevo(1, 80), individuoNuevo(2, 66), individuoNuevo(3, 20), individuoNuevo(4, 14)]
  // La 3 estaba muerta antes (es una reposición): no tiene altura anterior, no cuenta.
  assert.deepEqual(alturasSinCambio(individuos, anterior), [1, 4])
})

test('alturasSinCambio: ignora a los muertos y a los que no tienen altura elegida', () => {
  const individuos = [individuoMuerto(1), individuoNuevo(2, null), individuoMuerto(3), individuoNuevo(4, 15)]
  assert.deepEqual(alturasSinCambio(individuos, anterior), [])
})

test('alturasSinCambio: sin registro anterior, lista vacía', () => {
  const individuos = [individuoNuevo(1, 80), individuoNuevo(2, 59), individuoNuevo(3, 20), individuoNuevo(4, 14)]
  assert.deepEqual(alturasSinCambio(individuos, null), [])
})

test('esFormularioValido: un cambio brusco de altura no es un error', () => {
  // El árbol pasó de 80 a 10 cm (bajó mucho más de un 20 %): el aviso sale, pero se puede guardar.
  const individuos = [individuoNuevo(1, 10), individuoNuevo(2, 59), individuoMuerto(3), individuoNuevo(4, 14)]
  assert.equal(esFormularioValido({ errorFecha: null, fotoId: 55, individuos, observaciones: '' }), true)
})

// Un formulario completo, para cambiar de a un dato en cada caso.
const individuosValidos = [individuoNuevo(1, 80), individuoNuevo(2, 59), individuoMuerto(3), individuoNuevo(4, 14)]

test('esFormularioValido: con foto y todo completo es válido', () => {
  assert.equal(esFormularioValido({ errorFecha: null, fotoId: 55, individuos: individuosValidos, observaciones: '' }), true)
})

test('esFormularioValido: sin foto no es válido (RN-07)', () => {
  assert.equal(esFormularioValido({ errorFecha: null, fotoId: null, individuos: individuosValidos, observaciones: '' }), false)
  assert.equal(esFormularioValido({ errorFecha: null, fotoId: '', individuos: individuosValidos, observaciones: '' }), false)
  assert.equal(esFormularioValido({ errorFecha: null, individuos: individuosValidos, observaciones: '' }), false) // no vino
})

test('errorDeFoto: mensaje si falta, null si está', () => {
  assert.equal(errorDeFoto(null), 'Falta la foto de la célula.')
  assert.equal(errorDeFoto(''), 'Falta la foto de la célula.')
  assert.equal(errorDeFoto(55), null)
})
