// Tests de las funciones de altura (T14, CAR-07 y CAR-10). Se corren con "npm test" (node --test):
// usan el runner que ya trae Node, sin dependencias. Por eso los import llevan la extensión .js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { avisoDeAltura, diferenciaDeAltura, scrollParaCentrar, valorACentrar, valoresDelRango } from './individuos.js'
import { mesEnMinuscula, nombreDelMes } from './fechas.js'

test('diferenciaDeAltura: positiva, negativa y sin cambios', () => {
  assert.equal(diferenciaDeAltura(185, 173), 12)
  assert.equal(diferenciaDeAltura(168, 173), -5)
  assert.equal(diferenciaDeAltura(173, 173), 0)
})

test('diferenciaDeAltura: null si falta alguna de las dos alturas', () => {
  assert.equal(diferenciaDeAltura(null, 173), null) // altura todavía sin elegir
  assert.equal(diferenciaDeAltura(185, null), null) // sin altura anterior
})

test('avisoDeAltura: baja justo del 20 % no avisa, más del 20 % sí', () => {
  // 20 % de 100 es 20: bajar a 80 está justo en el límite.
  assert.equal(avisoDeAltura(80, 100), null)
  assert.equal(avisoDeAltura(79, 100), 'bajo')
  // Con un número que no da redondo: 20 % de 73 es 14,6. Bajar 14 (a 59) no avisa; bajar 15 (a 58) sí.
  assert.equal(avisoDeAltura(59, 73), null)
  assert.equal(avisoDeAltura(58, 73), 'bajo')
})

test('avisoDeAltura: suba de 50 cm justos no avisa, más de 50 cm sí', () => {
  assert.equal(avisoDeAltura(150, 100), null)
  assert.equal(avisoDeAltura(151, 100), 'subio')
})

test('avisoDeAltura: sin referencia o con cambios chicos no avisa', () => {
  assert.equal(avisoDeAltura(185, null), null)
  assert.equal(avisoDeAltura(null, 173), null)
  assert.equal(avisoDeAltura(180, 173), null)
})

test('valoresDelRango: todos los enteros, del primero al último', () => {
  assert.deepEqual(valoresDelRango(0, 3), [0, 1, 2, 3])
  const alturas = valoresDelRango(1, 999)
  assert.equal(alturas.length, 999)
  assert.equal(alturas[0], 1)
  assert.equal(alturas.at(-1), 999)
  assert.equal(valoresDelRango(0, 100).length, 101) // flores
})

test('valorACentrar: el elegido, si no la referencia, si no el primero', () => {
  assert.equal(valorACentrar(173, 160, 1), 173)
  assert.equal(valorACentrar(null, 160, 1), 160) // altura sin elegir: la del mes anterior
  assert.equal(valorACentrar(null, null, 1), 1) // registro inicial: desde arriba
  assert.equal(valorACentrar(0, null, 0), 0) // 0 flores es un valor, no "sin valor"
})

test('scrollParaCentrar: deja la fila en el medio, nunca negativo', () => {
  // Lista de 480 px (10 filas de 48): la fila 20 empieza en 960; para centrarla, 960 − 240 + 24.
  assert.equal(scrollParaCentrar(20, 48, 480), 744)
  assert.equal(scrollParaCentrar(0, 48, 480), 0) // la primera ya está arriba
  assert.equal(scrollParaCentrar(2, 48, 480), 0) // cerca del principio no se puede centrar
})

test('nombre del mes: con mayúscula para la línea, en minúscula para la frase', () => {
  assert.equal(nombreDelMes('2026-09'), 'Septiembre')
  assert.equal(mesEnMinuscula('2026-09'), 'septiembre')
})
