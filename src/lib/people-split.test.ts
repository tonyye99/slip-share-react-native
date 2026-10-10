/// <reference types="node" />

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { splitByPerson, totalsMessage } from './split.ts'

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
