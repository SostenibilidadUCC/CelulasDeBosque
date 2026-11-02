import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buscarProximaCelula } from './proximaCelula.js'

// Arma un "backend" de mentira que responde según el estado pedido.
function backendFalso(porEstado) {
  const pedidos = []
  const pedir = async (lugarId, filtros) => {
    pedidos.push({ lugarId, estado: filtros.estado })
    return { celulas: porEstado[filtros.estado] ?? [] }
  }
  return { pedir, pedidos }
}

test('devuelve la primera célula pendiente', async () => {
  const { pedir, pedidos } = backendFalso({ pendiente: [{ id: 7 }, { id: 9 }], 'sin-registro': [{ id: 3 }] })
  assert.equal(await buscarProximaCelula(1, pedir), 7)
  assert.deepEqual(pedidos, [{ lugarId: 1, estado: 'pendiente' }])
})

test('si no hay pendientes, devuelve la primera sin registro inicial', async () => {
  const { pedir, pedidos } = backendFalso({ 'sin-registro': [{ id: 3 }] })
  assert.equal(await buscarProximaCelula(1, pedir), 3)
  assert.deepEqual(pedidos.map((p) => p.estado), ['pendiente', 'sin-registro'])
})

test('si no queda nada para cargar, devuelve null', async () => {
  const { pedir } = backendFalso({})
  assert.equal(await buscarProximaCelula(1, pedir), null)
})
