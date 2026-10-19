// Tests de armarPedido (T14). Se corren con "npm test" (node --test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { armarPedido } from './pedido.js'

const vivo = { formaDeVida: 1, vivo: true, alturaCm: 185, flores: 0, frutos: false, plantulasNuevas: true }

test('armarPedido: un vivo manda sus 6 campos y nada más', () => {
  const { individuos } = armarPedido({ fecha: '2026-10-18', fotoId: 55, observaciones: '', individuos: [vivo] })
  assert.deepEqual(individuos[0], { formaDeVida: 1, vivo: true, alturaCm: 185, flores: 0, frutos: false, plantulasNuevas: true })
})

test('armarPedido: un muerto manda solo formaDeVida y vivo:false, aunque tenga datos viejos', () => {
  const muertoConDatos = { formaDeVida: 3, vivo: false, alturaCm: 20, flores: 2, frutos: true, plantulasNuevas: false }
  const { individuos } = armarPedido({ fecha: '2026-10-18', fotoId: 55, observaciones: '', individuos: [muertoConDatos] })
  assert.deepEqual(individuos[0], { formaDeVida: 3, vivo: false })
})

test('armarPedido: números como números y sí/no como booleanos', () => {
  // Por si algún control devolviera el valor como texto ("120" en vez de 120).
  const comoTexto = { formaDeVida: '2', vivo: true, alturaCm: '120', flores: '3', frutos: true, plantulasNuevas: false }
  const pedido = armarPedido({ fecha: '2026-10-18', fotoId: '55', observaciones: '', individuos: [comoTexto] })
  assert.equal(pedido.fotoId, 55)
  const [individuo] = pedido.individuos
  assert.equal(individuo.formaDeVida, 2)
  assert.equal(individuo.alturaCm, 120)
  assert.equal(individuo.flores, 3)
  assert.equal(typeof individuo.frutos, 'boolean')
  assert.equal(typeof individuo.plantulasNuevas, 'boolean')
})

test('armarPedido: observaciones sin espacios en los costados, y null si están vacías', () => {
  const armar = (observaciones) => armarPedido({ fecha: '2026-10-18', fotoId: 55, observaciones, individuos: [] }).observaciones
  assert.equal(armar('  Rebrote en la base  '), 'Rebrote en la base')
  assert.equal(armar(''), null)
  assert.equal(armar('   \n  '), null)
})

test('armarPedido: no manda campos de más', () => {
  const formulario = { fecha: '2026-10-18', fotoId: 55, observaciones: 'Hola', individuos: [vivo], polinizadores: 3 }
  const pedido = armarPedido(formulario)
  assert.deepEqual(Object.keys(pedido).sort(), ['fecha', 'fotoId', 'individuos', 'observaciones'])
  assert.equal(pedido.fecha, '2026-10-18')
})
