/// <reference types="node" />

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { badgeText, billStatus, biggestDebt, monthTotal, reminderText, type Bill } from './bills.ts'

const money = (amount: number) => `฿${amount.toFixed(2)}`

// People join in the order they're listed: Ye, then Anna, then Ben.
const joined = ['me', 'anna', 'ben']
const person = (id: string, name: string, extra: Partial<Bill['receipt_people'][number]> = {}) => ({
  id,
  name,
  is_me: false,
  is_payer: false,
  paid_at: null,
  created_at: `2026-10-0${joined.indexOf(id) + 1}T00:00:00Z`,
  ...extra,
})

const bill = (overrides: Partial<Bill> = {}): Bill => ({
  id: 'r1',
  merchant_name: 'KIANI',
  merchant_name_en: null,
  currency: 'THB',
  total: 300,
  subtotal: 300,
  tax_percent: 0,
  service_percent: 0,
  rounding: 0,
  user_type: 'payer',
  created_at: '2026-10-15T12:00:00Z',
  receipts_items: [
    { id: 'a', qty: 1, unit_price: 200, receipt_item_people: [{ person_id: 'me', units: 1 }, { person_id: 'ben', units: 1 }] },
    { id: 'b', qty: 1, unit_price: 100, receipt_item_people: [{ person_id: 'anna', units: 1 }] },
  ],
  receipt_people: [
    person('me', 'Ye', { is_me: true, is_payer: true }),
    person('anna', 'Anna'),
    person('ben', 'Ben'),
  ],
  ...overrides,
})

test('a bill with an item nobody had is still to split', () => {
  const status = billStatus(
    bill({ receipts_items: [...bill().receipts_items, { id: 'c', qty: 1, unit_price: 50, receipt_item_people: [] }] }),
  )
  assert.equal(status.state, 'to-split')
  assert.equal(status.unassignedItems, 1)
  assert.equal(badgeText(status, money), 'Not split yet')
})

test('a 2 × line with only one of them taken is still to split', () => {
  const status = billStatus(
    bill({ receipts_items: [{ id: 'beer', qty: 2, unit_price: 75, receipt_item_people: [{ person_id: 'me', units: 1 }] }] }),
  )
  assert.equal(status.state, 'to-split')
})

test('when you paid, everyone who has not paid back owes you, biggest first', () => {
  const status = billStatus(bill())
  assert.equal(status.state, 'waiting')
  assert.deepEqual(
    status.owedToYou.map((debt) => [debt.name, debt.amount, debt.index]),
    [
      ['Anna', 100, 1],
      ['Ben', 100, 2],
    ],
  )
  assert.equal(badgeText(status, money), '2 people owe ฿200.00')
})

test('one person left to pay back is named on the badge', () => {
  const status = billStatus(
    bill({
      receipt_people: [
        person('me', 'Ye', { is_me: true, is_payer: true }),
        person('anna', 'Anna', { paid_at: '2026-10-16T00:00:00Z' }),
        person('ben', 'Ben'),
      ],
    }),
  )
  assert.equal(badgeText(status, money), 'Ben owes ฿100.00')
})

test('everyone paid back is settled', () => {
  const paid = '2026-10-16T00:00:00Z'
  const status = billStatus(
    bill({
      receipt_people: [
        person('me', 'Ye', { is_me: true, is_payer: true }),
        person('anna', 'Anna', { paid_at: paid }),
        person('ben', 'Ben', { paid_at: paid }),
      ],
    }),
  )
  assert.equal(status.state, 'settled')
  assert.equal(badgeText(status, money), 'Settled')
})

test('a bill you had all to yourself is settled', () => {
  const status = billStatus(
    bill({
      receipts_items: [{ id: 'a', qty: 1, unit_price: 80, receipt_item_people: [{ person_id: 'me', units: 1 }] }],
      receipt_people: [person('me', 'Ye', { is_me: true, is_payer: true })],
    }),
  )
  assert.equal(status.state, 'settled')
})

test('when someone else paid, it waits on what you owe them', () => {
  const status = billStatus(
    bill({
      receipt_people: [person('me', 'Ye', { is_me: true }), person('anna', 'Anna', { is_payer: true }), person('ben', 'Ben')],
    }),
  )
  assert.equal(status.state, 'waiting')
  assert.deepEqual(status.owedToYou, [])
  assert.equal(status.youOwe, 100)
  assert.equal(badgeText(status, money), 'You owe ฿100.00')
})

test('the waiting card picks the biggest debt across bills', () => {
  const small = bill()
  const big = bill({
    id: 'r2',
    merchant_name: 'Khrua',
    receipts_items: [{ id: 'x', qty: 1, unit_price: 500, receipt_item_people: [{ person_id: 'ben', units: 1 }] }],
  })
  const top = biggestDebt([small, big].map((one) => ({ bill: one, status: billStatus(one) })))
  assert.equal(top?.bill.id, 'r2')
  assert.equal(top?.debt.name, 'Ben')
  assert.equal(top?.debt.amount, 500)
})

test('this month adds up bills from this month only', () => {
  const now = new Date('2026-10-18T09:00:00Z')
  const result = monthTotal(
    [
      bill({ total: 579, created_at: '2026-10-18T08:00:00Z' }),
      bill({ total: 2147.01, created_at: '2026-10-15T12:00:00Z' }),
      bill({ total: 999, created_at: '2026-09-30T12:00:00Z' }),
    ],
    now,
  )
  assert.equal(result.count, 2)
  assert.equal(Math.round(result.total * 100) / 100, 2726.01)
})

test('the reminder names the amount and the bill', () => {
  assert.equal(
    reminderText({ name: 'Ben', amount: 715.67 }, 'KIANI', 'Wed, Oct 15', money),
    'Hi Ben! A quick reminder: ฿715.67 for KIANI on Wed, Oct 15. Thank you!',
  )
})
