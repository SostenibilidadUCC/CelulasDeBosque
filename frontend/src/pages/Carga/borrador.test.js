// Tests del borrador de la carga mensual (T17). Se corren con "npm test" (node --test).
// En vez del localStorage del navegador se usa un almacén falso con los mismos métodos.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  armarBorrador,
  borrarBorrador,
  claveDeBorrador,
  guardarBorrador,
  huboCambios,
  leerBorrador,
  limpiarBorradoresViejos,
} from './borrador.js'

// Almacén falso: un Map con getItem, setItem, removeItem, key y length, como localStorage.
function almacenFalso() {
  const datos = new Map()
  return {
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => datos.set(clave, String(valor)),
    removeItem: (clave) => datos.delete(clave),
    key: (i) => [...datos.keys()][i] ?? null,
    get length() {
      return datos.size
    },
  }
}

// Almacén que falla en todo, como localStorage en modo privado o lleno.
const almacenQueFalla = {
  getItem() {
    throw new Error('SecurityError')
  },
  setItem() {
    throw new Error('QuotaExceededError')
  },
  removeItem() {
    throw new Error('SecurityError')
  },
  key() {
    throw new Error('SecurityError')
  },
  get length() {
    throw new Error('SecurityError')
  },
}

const individuos = [
  { formaDeVida: 1, vivo: true, alturaCm: 120, flores: 0, frutos: false, plantulasNuevas: false },
  { formaDeVida: 2, vivo: true, alturaCm: 80, flores: 3, frutos: true, plantulasNuevas: false },
  { formaDeVida: 3, vivo: false },
  { formaDeVida: 4, vivo: true, alturaCm: 10, flores: 0, frutos: false, plantulasNuevas: true },
]
const borrador = armarBorrador({
  periodo: '2026-11',
  fecha: '2026-11-11',
  individuos,
  observaciones: 'Riego el lunes',
  fotoId: 33,
})
const donde = { usuarioId: 7, celulaId: 45, periodo: '2026-11' }

test('guarda y lee el borrador de la misma persona, célula y período', () => {
  const almacen = almacenFalso()
  assert.equal(guardarBorrador(donde, borrador, almacen), true)
  assert.deepEqual(leerBorrador(donde, almacen), borrador)
})

test('la clave incluye usuario, célula y período', () => {
  assert.equal(claveDeBorrador(7, 45, '2026-11'), 'borrador-carga:7:45:2026-11')
})

test('otro usuario en el mismo celular no ve el borrador', () => {
  const almacen = almacenFalso()
  guardarBorrador(donde, borrador, almacen)
  assert.equal(leerBorrador({ ...donde, usuarioId: 8 }, almacen), null)
})

test('un borrador de un período anterior no se ofrece', () => {
  const almacen = almacenFalso()
  guardarBorrador(donde, { ...borrador, periodo: '2026-10' }, almacen)
  // Se busca el de noviembre: el de octubre está en otra clave.
  assert.equal(leerBorrador(donde, almacen), null)
  // Y aunque alguien lo hubiera guardado con la clave de noviembre, el período de adentro no coincide.
  almacen.setItem(claveDeBorrador(7, 45, '2026-11'), JSON.stringify({ ...borrador, periodo: '2026-10' }))
  assert.equal(leerBorrador(donde, almacen), null)
})

test('JSON roto: no hay borrador (y no tira error)', () => {
  const almacen = almacenFalso()
  almacen.setItem(claveDeBorrador(7, 45, '2026-11'), '{"periodo": "2026-11", "fecha":')
  assert.equal(leerBorrador(donde, almacen), null)
})

test('JSON con otra forma (sin los 4 individuos): no hay borrador', () => {
  const almacen = almacenFalso()
  almacen.setItem(claveDeBorrador(7, 45, '2026-11'), JSON.stringify({ ...borrador, individuos: individuos.slice(0, 2) }))
  assert.equal(leerBorrador(donde, almacen), null)
})

test('localStorage que tira error: leer da null, guardar da false y nada explota', () => {
  assert.equal(leerBorrador(donde, almacenQueFalla), null)
  assert.equal(guardarBorrador(donde, borrador, almacenQueFalla), false)
  assert.doesNotThrow(() => borrarBorrador(donde, almacenQueFalla))
  assert.doesNotThrow(() => limpiarBorradoresViejos(7, '2026-11', almacenQueFalla))
})

test('borrarBorrador lo saca', () => {
  const almacen = almacenFalso()
  guardarBorrador(donde, borrador, almacen)
  borrarBorrador(donde, almacen)
  assert.equal(leerBorrador(donde, almacen), null)
})

test('limpiarBorradoresViejos borra solo los de meses anteriores de ese usuario', () => {
  const almacen = almacenFalso()
  almacen.setItem(claveDeBorrador(7, 45, '2026-10'), 'viejo')
  almacen.setItem(claveDeBorrador(7, 46, '2026-11'), 'actual')
  almacen.setItem(claveDeBorrador(8, 45, '2026-10'), 'de otra persona')
  almacen.setItem('otra-cosa', 'x')
  limpiarBorradoresViejos(7, '2026-11', almacen)
  assert.equal(almacen.getItem(claveDeBorrador(7, 45, '2026-10')), null)
  assert.equal(almacen.getItem(claveDeBorrador(7, 46, '2026-11')), 'actual')
  assert.equal(almacen.getItem(claveDeBorrador(8, 45, '2026-10')), 'de otra persona')
  assert.equal(almacen.getItem('otra-cosa'), 'x')
})

test('huboCambios: igual a lo precargado → false; cualquier dato distinto → true', () => {
  const iniciales = { fecha: '2026-11-11', individuos, observaciones: '', fotoId: null }
  assert.equal(huboCambios({ ...iniciales, individuos: individuos.map((i) => ({ ...i })) }, iniciales), false)
  assert.equal(huboCambios({ ...iniciales, observaciones: 'x' }, iniciales), true)
  assert.equal(huboCambios({ ...iniciales, fotoId: 33 }, iniciales), true)
  assert.equal(huboCambios({ ...iniciales, fecha: '2026-11-10' }, iniciales), true)
  const otraAltura = individuos.map((i) => (i.formaDeVida === 1 ? { ...i, alturaCm: 121 } : i))
  assert.equal(huboCambios({ ...iniciales, individuos: otraAltura }, iniciales), true)
})
