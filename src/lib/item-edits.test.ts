/// <reference types="node" />

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { itemErrors, newItemInput, parseNumber, toItemInputs, toParsedItems } from './item-edits.ts'

test('parseNumber reads plain, decimal-comma and negative numbers', () => {
  assert.equal(parseNumber('289'), 289)
  assert.equal(parseNumber(' 45,50 '), 45.5)
  assert.equal(parseNumber('-20'), -20)
  assert.equal(parseNumber('.5'), 0.5)
  assert.equal(parseNumber('12.'), 12)
  assert.equal(parseNumber(''), null)
  assert.equal(parseNumber('12a'), null)
  assert.equal(parseNumber('1,000.50'), null)
})

test('a new item needs a name and a price, and qty must be above 0', () => {
  const item = newItemInput()
  assert.deepEqual(Object.keys(itemErrors(item)).sort(), ['name', 'unit_price'])
  assert.ok(itemErrors({ ...item, name: 'Water', unit_price: '20', qty: '0' }).qty)
  assert.deepEqual(itemErrors({ ...item, name: 'Discount', unit_price: '-50' }), {})
})

test('edited items round to what the database stores, and invalid edits block saving', () => {
  const [input] = toItemInputs([{ id: '22', name: 'Stir Fried', name_en: 'Stir fry', qty: 1, unit_price: 289 }])
  const edited = { ...input, qty: '0.3333', unit_price: '45.556' }
  assert.deepEqual(toParsedItems([edited]), [
    { id: input.key, name: 'Stir Fried', name_en: 'Stir fry', qty: 0.333, unit_price: 45.56 },
  ])
  assert.equal(toParsedItems([{ ...edited, name: '  ' }]), null)
  assert.equal(toParsedItems([]), null)
})
