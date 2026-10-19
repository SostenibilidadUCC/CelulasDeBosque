// Tests de mensajeDeGuardado (T14). Se corren con "npm test" (node --test).
// Los errores se arman a mano con la misma forma que ErrorApi ({ message, estado, datos }), así el
// test no necesita importar api.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mensajeDeGuardado } from './errores.js'

const error = (estado, datos = null, message = 'Mensaje del servidor') => ({ estado, datos, message })

test('409 del mes en curso: avisa y ofrece ver lo guardado', () => {
  const resultado = mensajeDeGuardado(error(409, { error: 'x', registroId: 812 }), { fechaEsDelMesActual: true })
  assert.deepEqual(resultado, { texto: 'Esta célula ya tiene un registro de ese mes.', verRegistroDelMes: true })
})

test('409 de un mes anterior: avisa, pero sin el botón (la pantalla no puede abrir ese registro)', () => {
  const resultado = mensajeDeGuardado(error(409, { registroId: 812 }), { fechaEsDelMesActual: false })
  assert.equal(resultado.verRegistroDelMes, false)
})

test('403: sin permiso', () => {
  assert.equal(mensajeDeGuardado(error(403), { fechaEsDelMesActual: true }).texto, 'No tenés permiso para cargar en este lugar.')
})

test('400: el mensaje que manda el servidor', () => {
  const resultado = mensajeDeGuardado(error(400, { error: 'La fecha no puede ser futura' }), { fechaEsDelMesActual: true })
  assert.equal(resultado.texto, 'La fecha no puede ser futura')
})

test('sin conexión: avisa que lo cargado sigue en pantalla', () => {
  const resultado = mensajeDeGuardado(error(0), { fechaEsDelMesActual: true })
  assert.equal(resultado.texto, 'No hay conexión. Lo que cargaste sigue acá: probá de nuevo.')
})

test('otro error (500): el mensaje del ErrorApi, nunca vacío', () => {
  assert.equal(mensajeDeGuardado(error(500, null, 'Error del servidor'), { fechaEsDelMesActual: true }).texto, 'Error del servidor')
  assert.ok(mensajeDeGuardado(error(500, null, ''), { fechaEsDelMesActual: true }).texto.length > 0)
})
