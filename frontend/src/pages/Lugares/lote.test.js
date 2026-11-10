// Tests de las funciones del lote de células (T20, LUG-07). Se corren con "npm test" (node --test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { celulasConLote, resumenDelLote, siguienteNumeroCelula } from './lote.js'

test('siguienteNumeroCelula: el número más alto más uno, también contando las dadas de baja', () => {
  const celulas = [{ numero: 4 }, { numero: 12, estado: 'baja' }, { numero: 7 }]
  assert.equal(siguienteNumeroCelula(celulas), 13)
})

test('siguienteNumeroCelula: sin células, arranca en 1', () => {
  assert.equal(siguienteNumeroCelula([]), 1)
})

test('celulasConLote: suma las nuevas a las que ya están, sin estado y con un id que no choca', () => {
  const existentes = [{ id: 31, numero: 2, codigo: 'Z-1-2', fila: 1, columna: 2, estado: 'sin-registro' }]
  const lote = [
    { numero: 3, codigo: 'Z-1-3', fila: 1, columna: 1 },
    { numero: 4, codigo: 'Z-1-4', fila: 1, columna: 3 },
  ]
  assert.deepEqual(celulasConLote(existentes, lote), [
    existentes[0],
    { id: 'nueva-3', numero: 3, codigo: 'Z-1-3', fila: 1, columna: 1 },
    { id: 'nueva-4', numero: 4, codigo: 'Z-1-4', fila: 1, columna: 3 },
  ])
})

test('resumenDelLote: dice cuántas y de qué código a qué código', () => {
  const lote = [{ codigo: 'Z-1-3' }, { codigo: 'Z-1-4' }, { codigo: 'Z-1-5' }]
  assert.equal(resumenDelLote(lote), '3 células: de Z-1-3 a Z-1-5')
})

test('resumenDelLote: con una sola célula, sin "de… a…"', () => {
  assert.equal(resumenDelLote([{ codigo: 'Z-1-9' }]), '1 célula: Z-1-9')
})
