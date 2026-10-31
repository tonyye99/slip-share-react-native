/// <reference types="node" />

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { billTotal, checkScan, dropIncludedCharges, receiptSubtotal, readSavedCharges, splitByPicks, type Counts } from './split.ts'

// The example receipt from slip-share's CLAUDE.md: 5% service, then 7% VAT on
// the items plus service (slip-share stored that VAT as 7.35% of the items).
const items = [
  { id: 'a', qty: 1, unit_price: 289 },
  { id: 'b', qty: 1, unit_price: 279 },
  { id: 'c', qty: 1, unit_price: 239 },
  { id: 'd', qty: 1, unit_price: 20 },
]
const receipt = { subtotal: 827, tax_percent: 7, service_percent: 5, rounding: 0 }

/** What "me" pays when they had the items in `mine`, sharing the ones in `shared` with one friend. */
function myShare(bill: typeof receipt, lines: typeof items, mine: string[], shared: string[] = []) {
  const picks: Counts = {}
  for (const id of mine) picks[id] = { me: 1 }
  for (const id of shared) picks[id] = { me: 1, friend: 1 }
  return splitByPicks(bill, lines, ['me', 'friend'], picks).people.me
}

test('subtotal sums qty * unit price', () => {
  assert.equal(receiptSubtotal(items), 827)
})

test('everything selected matches the receipt total', () => {
  const split = myShare(receipt, items, ['a', 'b', 'c', 'd'])
  assert.equal(split.subtotal, 827)
  assert.equal(split.proportion, 1)
  assert.ok(Math.abs(split.total - 929.13) < 0.01)
})

test('shared item is divided by share count before tax and service', () => {
  const split = myShare(receipt, items, ['d'], ['a'])
  assert.equal(split.subtotal, 289 / 2 + 20)
  assert.ok(Math.abs(split.service - split.subtotal * 0.05) < 1e-9)
  assert.ok(Math.abs(split.tax - split.subtotal * 1.05 * 0.07) < 1e-9)
})

test('VAT is charged on the service charge too', () => {
  // 10% service, then 7% VAT on ฿1,100: the receipt says ฿1,177, not ฿1,170.
  assert.ok(Math.abs(billTotal({ tax_percent: 7, service_percent: 10, rounding: 0 }, 1000) - 1177) < 1e-9)
})

test('rounding is split by share of subtotal', () => {
  const split = myShare({ ...receipt, rounding: 0.5 }, items, ['a'])
  assert.ok(Math.abs(split.rounding - 0.5 * (289 / 827)) < 1e-9)
})

test('decimal prices work', () => {
  const split = myShare({ subtotal: 45.5, tax_percent: 0, service_percent: 0, rounding: 0 }, [{ id: 'x', qty: 1, unit_price: 45.5 }], ['x'])
  assert.equal(split.total, 45.5)
})

test('nothing selected is zero', () => {
  assert.equal(myShare(receipt, items, []).total, 0)
})

test('VAT already in the prices is dropped', () => {
  // "VAT Included" receipt: items add up to the printed total, and VAT 7% is only a breakdown.
  const parsed = { tax_percent: 7, service_percent: 0, rounding: 0, total: 579 }
  assert.deepEqual(dropIncludedCharges(parsed, 579), { ...parsed, tax_percent: 0 })
})

test('charges added on top of the prices are kept', () => {
  const parsed = { tax_percent: 7, service_percent: 5, rounding: 0, total: 929.13 }
  assert.equal(dropIncludedCharges(parsed, 827), parsed)
})

test('a tax rate read as a share of the items goes back to the printed rate', () => {
  const parsed = { tax_percent: 7.35, service_percent: 5, rounding: 0, total: 929.13 }
  assert.deepEqual(dropIncludedCharges(parsed, 827), { ...parsed, tax_percent: 7 })
})

test('saved bills: tax on service unless only the items add up', () => {
  const current = { subtotal: 1000, tax_percent: 7, service_percent: 10, rounding: 0, total: 1177 }
  assert.equal(readSavedCharges(current), current)
  // Kept as a share of the items: back to the printed 7%.
  const asShare = { ...current, tax_percent: 7.7 }
  assert.deepEqual(readSavedCharges(asShare), current)
  // Total of 7% on the items alone (7 / 1.1 isn't a printed rate): tax stays on the items.
  const itemsOnly = { ...current, total: 1170 }
  assert.deepEqual(readSavedCharges(itemsOnly), { ...itemsOnly, tax_on_items_only: true })
  const misread = { ...current, total: 1500 }
  assert.equal(readSavedCharges(misread), misread)
})

test('a scan whose total has tax on the items alone keeps it there', () => {
  const parsed = { tax_percent: 7, service_percent: 10, rounding: 0, total: 1170 }
  assert.deepEqual(dropIncludedCharges(parsed, 1000), { ...parsed, tax_on_items_only: true })
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
