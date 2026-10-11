/// <reference types="node" />

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { calculateSplit, checkScan, dropIncludedCharges, receiptSubtotal } from './split.ts'

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
  const split = calculateSplit(receipt, items, ['a', 'b', 'c', 'd'], {})
  assert.equal(split.subtotal, 827)
  assert.equal(split.proportion, 1)
  assert.ok(Math.abs(split.total - 929.13) < 0.01)
})

test('shared item is divided by share count before tax and service', () => {
  const split = calculateSplit(receipt, items, ['a', 'd'], { a: 2 })
  assert.equal(split.subtotal, 289 / 2 + 20)
  assert.ok(Math.abs(split.tax - split.subtotal * 0.0735) < 1e-9)
  assert.ok(Math.abs(split.service - split.subtotal * 0.05) < 1e-9)
})

test('rounding is split by share of subtotal', () => {
  const split = calculateSplit({ ...receipt, rounding: 0.5 }, items, ['a'], {})
  assert.ok(Math.abs(split.rounding - 0.5 * (289 / 827)) < 1e-9)
})

test('decimal prices work', () => {
  const split = calculateSplit(
    { subtotal: 45.5, tax_percent: 0, service_percent: 0, rounding: 0 },
    [{ id: 'x', qty: 1, unit_price: 45.5 }],
    ['x'],
    {},
  )
  assert.equal(split.total, 45.5)
})

test('nothing selected is zero', () => {
  assert.equal(calculateSplit(receipt, items, [], {}).total, 0)
})

test('VAT already in the prices is dropped', () => {
  // "VAT Included" receipt: items add up to the printed total, and VAT 7% is only a breakdown.
  const parsed = { tax_percent: 7, service_percent: 0, rounding: 0, total: 579 }
  assert.deepEqual(dropIncludedCharges(parsed, 579), { ...parsed, tax_percent: 0 })
})

test('charges added on top of the prices are kept', () => {
  const parsed = { tax_percent: 7.35, service_percent: 5, rounding: 0, total: 929.13 }
  assert.equal(dropIncludedCharges(parsed, 827), parsed)
})

test('service on top with VAT included keeps only the service', () => {
  const parsed = { tax_percent: 7, service_percent: 10, rounding: 0, total: 1100 }
  assert.deepEqual(dropIncludedCharges(parsed, 1000), { ...parsed, tax_percent: 0 })
})

test('charges are kept when nothing matches or the total is missing', () => {
  const noMatch = { tax_percent: 7, service_percent: 0, rounding: 0, total: 900 }
  assert.equal(dropIncludedCharges(noMatch, 579), noMatch)
  const noTotal = { tax_percent: 7, service_percent: 0, rounding: 0, total: 0 }
  assert.equal(dropIncludedCharges(noTotal, 579), noTotal)
})

// The ramen receipt: "2 ราเมงข้อสอบ 320" was read as 2 × 320, and VAT 7% is included.
const ramen = {
  tax_percent: 7,
  service_percent: 0,
  rounding: 0,
  total: 579,
  items: [
    { qty: 2, unit_price: 320 },
    { qty: 1, unit_price: 220 },
    { qty: 1, unit_price: 20 },
    { qty: 1, unit_price: 19 },
  ],
}

test('a line total read as the price of one is divided by the quantity', () => {
  const checked = checkScan(ramen)
  assert.deepEqual(checked.items[0], { qty: 2, unit_price: 160 })
  assert.equal(receiptSubtotal(checked.items), 579)
  assert.equal(checked.tax_percent, 0)
})

test('prices that already reach the total are left alone', () => {
  const read = { ...ramen, items: [{ qty: 2, unit_price: 160 }, ...ramen.items.slice(1)] }
  assert.deepEqual(checkScan(read), { ...read, tax_percent: 0 })
  const onTop = { ...read, total: 619.53 }
  assert.equal(checkScan(onTop), onTop)
})

test('prices are kept when dividing them does not match either', () => {
  const noMatch = { ...ramen, total: 1000 }
  assert.equal(checkScan(noMatch), noMatch)
})
