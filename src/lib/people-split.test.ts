/// <reference types="node" />

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { evenCount, splitByPerson, totalsMessage } from './split.ts'

// The example receipt from slip-share's CLAUDE.md.
const items = [
  { id: 'a', qty: 1, unit_price: 289 },
  { id: 'b', qty: 1, unit_price: 279 },
  { id: 'c', qty: 1, unit_price: 239 },
  { id: 'd', qty: 1, unit_price: 20 },
]
const receipt = { subtotal: 827, tax_percent: 7.35, service_percent: 5, rounding: 0 }

test('a shared item is split evenly between the people who had it', () => {
  const split = splitByPerson(receipt, items, ['me', 'alice'], { a: ['me', 'alice'], b: ['alice'], d: ['me'] })
  assert.equal(split.people.me.subtotal, 289 / 2 + 20)
  assert.equal(split.people.alice.subtotal, 289 / 2 + 279)
  assert.ok(Math.abs(split.people.me.tax - (7.35 / 100) * (289 / 2 + 20)) < 1e-9)
})

test('items nobody had are reported as unassigned', () => {
  const split = splitByPerson(receipt, items, ['me', 'alice'], { a: ['me', 'alice'], b: ['alice'], d: ['me'] })
  assert.equal(split.unassigned.subtotal, 239)
  const everyone = split.people.me.total + split.people.alice.total + split.unassigned.total
  assert.ok(Math.abs(everyone - 929.13) < 0.01)
})

test('someone with no items owes nothing', () => {
  const split = splitByPerson(receipt, items, ['me', 'bob'], { a: ['me'] })
  assert.equal(split.people.bob.total, 0)
})

test('splitting everything evenly adds up to the bill', () => {
  const everyone = ['me', 'alice', 'bob']
  const split = splitByPerson(receipt, items, everyone, Object.fromEntries(items.map((item) => [item.id, everyone])))
  assert.ok(Math.abs(split.people.bob.total - 929.13 / 3) < 0.01)
  assert.equal(split.unassigned.total, 0)
})

// "2 × Egg Kim Bab" at 199 each.
const kimbab = [{ id: 'k', qty: 2, unit_price: 199 }]
const kimbabReceipt = { subtotal: 398, tax_percent: 0, service_percent: 0, rounding: 0 }

test('on a 2× line each person pays for how many they had', () => {
  const split = splitByPerson(kimbabReceipt, kimbab, ['htet', 'tony'], { k: ['htet', 'tony'] }, { k: { htet: 1, tony: 1 } })
  assert.equal(split.people.htet.subtotal, 199)
  assert.equal(split.people.tony.subtotal, 199)
  assert.equal(split.unassigned.subtotal, 0)
})

test('the rest of a 2× line stays unassigned until someone has it', () => {
  const split = splitByPerson(kimbabReceipt, kimbab, ['htet', 'tony'], { k: ['htet'] }, { k: { htet: 1 } })
  assert.equal(split.people.htet.subtotal, 199)
  assert.equal(split.unassigned.subtotal, 199)
})

test('someone can have the whole 2× line', () => {
  const split = splitByPerson(kimbabReceipt, kimbab, ['htet'], { k: ['htet'] }, { k: { htet: 2 } })
  assert.equal(split.people.htet.subtotal, 398)
  assert.equal(split.unassigned.subtotal, 0)
})

test('more counted than the line has is shared in proportion', () => {
  // Three people each say 1 of the 2: they shared them.
  const split = splitByPerson(kimbabReceipt, kimbab, ['a', 'b', 'c'], { k: ['a', 'b', 'c'] }, { k: { a: 1, b: 1, c: 1 } })
  assert.ok(Math.abs(split.people.a.subtotal - 398 / 3) < 1e-9)
  assert.equal(split.unassigned.subtotal, 0)
  // Picks from before counts were saved as the whole line, so two people still split it evenly.
  const old = splitByPerson(kimbabReceipt, kimbab, ['a', 'b'], { k: ['a', 'b'] }, { k: { a: 2, b: 2 } })
  assert.equal(old.people.a.subtotal, 199)
})

test('even counts share a line with nothing left over', () => {
  const beer = [{ id: 'b', qty: 3, unit_price: 90 }]
  const each = evenCount(beer[0], 2)
  assert.equal(each, 2)
  const split = splitByPerson({ ...kimbabReceipt, subtotal: 270 }, beer, ['a', 'b'], { b: ['a', 'b'] }, { b: { a: each, b: each } })
  assert.equal(split.people.a.subtotal, 135)
  assert.equal(split.people.b.subtotal, 135)
  assert.equal(split.unassigned.subtotal, 0)
  assert.equal(evenCount({ qty: 1.5 }, 2), 1)
})

test('a line that is not a whole count of 2 or more is shared evenly', () => {
  const weighed = [{ id: 'w', qty: 1.5, unit_price: 100 }]
  const split = splitByPerson({ ...kimbabReceipt, subtotal: 150 }, weighed, ['a', 'b'], { w: ['a', 'b'] }, { w: { a: 1 } })
  assert.equal(split.people.a.subtotal, 75)
  assert.equal(split.unassigned.subtotal, 0)
})

test('totals message lists everyone, who paid and the charges', () => {
  const message = totalsMessage({
    title: 'Thai Restaurant',
    currency: 'USD',
    total: 929.13,
    service_percent: 5,
    tax_percent: 7.35,
    payer: 'me',
    people: [
      { name: 'Me', total: 300, paid: false },
      { name: 'Alice', total: 329.13, paid: true },
    ],
    unassigned: 300,
  })
  assert.equal(
    message,
    [
      'Thai Restaurant: $929.13',
      'Paid by me.',
      '',
      'Me: $300.00',
      'Alice: $329.13 (paid)',
      'Not assigned yet: $300.00',
      '',
      'Includes 5% service and 7.35% tax.',
    ].join('\n'),
  )
})

test('totals message leaves out paid marks when nobody is the payer', () => {
  const message = totalsMessage({
    title: 'Cafe',
    currency: 'USD',
    total: 10,
    service_percent: 0,
    tax_percent: 0,
    payer: null,
    people: [{ name: 'Alice', total: 10, paid: true }],
    unassigned: 0,
  })
  assert.equal(message, 'Cafe: $10.00\n\nAlice: $10.00')
})
