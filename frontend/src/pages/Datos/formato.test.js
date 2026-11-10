import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fechaTabla, numero, siNo, SIN_DATO } from './formato.js'

test('fechaTabla: día/mes/año', () => {
  assert.equal(fechaTabla('2026-11-18'), '18/11/2026')
})

test('siNo: sí, no y sin dato', () => {
  assert.equal(siNo(true), 'Sí')
  assert.equal(siNo(false), 'No')
  assert.equal(siNo(null), SIN_DATO)
})

test('numero: formato argentino y sin dato', () => {
  assert.equal(numero(1420.5), '1.420,5')
  assert.equal(numero(0), '0')
  assert.equal(numero(null), SIN_DATO)
})
