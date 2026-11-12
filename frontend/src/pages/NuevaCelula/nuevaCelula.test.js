// Tests de las funciones de Nueva célula (T17). Se corren con "npm test" (node --test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { celulasConProvisoria, codigoNuevo, errorDeNumero, ID_PROVISORIA, primerNumeroLibre } from './nuevaCelula.js'

const celula = (numero, fila = 1, columna = numero, estado = 'al-dia') => ({ id: numero * 10, numero, codigo: `A-1-${numero}`, fila, columna, estado })

test('primerNumeroLibre: isleta vacía sugiere 1', () => {
  assert.equal(primerNumeroLibre([]), 1)
})

test('primerNumeroLibre: sugiere el primer hueco, no el más alto más uno', () => {
  assert.equal(primerNumeroLibre([celula(1), celula(2), celula(4)]), 3)
})

test('primerNumeroLibre: las dadas de baja cuentan como usadas (RN-02)', () => {
  assert.equal(primerNumeroLibre([celula(1), celula(2, 1, 2, 'baja')]), 3)
})

test('primerNumeroLibre: con los 200 usados, null', () => {
  const todas = Array.from({ length: 200 }, (_, i) => celula(i + 1))
  assert.equal(primerNumeroLibre(todas), null)
})

test('errorDeNumero: vacío, fuera de rango, con decimales o usado', () => {
  const celulas = [celula(5)]
  assert.equal(errorDeNumero('', celulas), 'Escribí el número de la célula.')
  assert.equal(errorDeNumero('0', celulas), 'El número tiene que ser de 1 a 200.')
  assert.equal(errorDeNumero('201', celulas), 'El número tiene que ser de 1 a 200.')
  assert.equal(errorDeNumero('2.5', celulas), 'El número tiene que ser de 1 a 200.')
  assert.equal(errorDeNumero('5', celulas), 'Ya hay una célula con el número 5 en esta isleta. Elegí otro.')
  assert.equal(errorDeNumero('6', celulas), null)
})

test('codigoNuevo: Lugar-Isleta-Número', () => {
  assert.equal(codigoNuevo('A', 1, 61), 'A-1-61')
})

test('celulasConProvisoria: sin celda elegida, las mismas células', () => {
  const celulas = [celula(1)]
  assert.equal(celulasConProvisoria(celulas, null, 2, 'A-1-2'), celulas)
})

test('celulasConProvisoria: suma la nueva sin estado y con un id que no choca', () => {
  const resultado = celulasConProvisoria([celula(1)], { fila: 7, columna: 1 }, 61, 'A-1-61')
  assert.equal(resultado.length, 2)
  assert.deepEqual(resultado[1], { id: ID_PROVISORIA, numero: 61, codigo: 'A-1-61', fila: 7, columna: 1 })
  assert.equal(resultado[1].estado, undefined)
})
