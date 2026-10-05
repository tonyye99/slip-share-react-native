/// <reference types="node" />

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { calculateSplit, receiptSubtotal } from './split.ts'

// The example receipt from slip-share's CLAUDE.md.
const items = [
  { id: 'a', qty: 1, unit_price: 289 },
  { id: 'b', qty: 1, unit_price: 279 },
  { id: 'c', qty: 1, unit_price: 239 },
  { id: 'd', qty: 1, unit_price: 20 },
]
const receipt = { subtotal: 827, tax_percent: 7.35, service_percent: 5, rounding: 0 }

test('subtotal sums qty * unit price', () => {
  assert.equal(receiptSubtotal(items), 827)
})

test('everything selected matches the receipt total', () => {
  const r = calculateSplit(receipt, items, ['a', 'b', 'c', 'd'], {})
  assert.equal(r.subtotal, 827)
  assert.equal(r.proportion, 1)
  assert.ok(Math.abs(r.total - 929.13) < 0.01)
})

test('shared item is divided by share count before tax and service', () => {
  const r = calculateSplit(receipt, items, ['a', 'd'], { a: 2 })
  assert.equal(r.subtotal, 289 / 2 + 20)
  assert.ok(Math.abs(r.tax - r.subtotal * 0.0735) < 1e-9)
  assert.ok(Math.abs(r.service - r.subtotal * 0.05) < 1e-9)
})

test('rounding is split by share of subtotal', () => {
  const r = calculateSplit({ ...receipt, rounding: 0.5 }, items, ['a'], {})
  assert.ok(Math.abs(r.rounding - 0.5 * (289 / 827)) < 1e-9)
})

test('decimal prices work', () => {
  const r = calculateSplit(
    { subtotal: 45.5, tax_percent: 0, service_percent: 0, rounding: 0 },
    [{ id: 'x', qty: 1, unit_price: 45.5 }],
    ['x'],
    {},
  )
  assert.equal(r.total, 45.5)
})

test('nothing selected is zero', () => {
  assert.equal(calculateSplit(receipt, items, [], {}).total, 0)
})
