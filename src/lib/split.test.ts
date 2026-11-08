/// <reference types="node" />

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  billTotal,
  checkScan,
  formatMoney,
  dropIncludedCharges,
  itemShares,
  receiptSubtotal,
  readSavedCharges,
  splitByPicks,
  type Counts,
} from './split.ts'

const items = [
  { id: 'a', qty: 1, unit_price: 289 },
  { id: 'b', qty: 1, unit_price: 279 },
  { id: 'c', qty: 1, unit_price: 239 },
  { id: 'd', qty: 1, unit_price: 20 },
]
const receipt = { subtotal: 827, tax_percent: 7, service_percent: 5, rounding: 0 }

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
  const asShare = { ...current, tax_percent: 7.7 }
  assert.deepEqual(readSavedCharges(asShare), current)
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

const coffeeClub = {
  tax_percent: 7,
  service_percent: 10,
  service_amount: 99,
  rounding: 0,
  total: 1058,
  items: [
    { qty: 1, unit_price: 270 },
    { qty: 1, unit_price: 270 },
    { qty: 1, unit_price: 59 },
    { qty: 1, unit_price: 140 },
    { qty: 1, unit_price: 220 },
    { qty: 1, unit_price: 30 },
    { qty: 1, unit_price: -30 },
  ],
}

test('a printed service amount wins, and VAT included adds nothing', () => {
  const checked = checkScan(coffeeClub)
  assert.equal(checked.tax_percent, 0)
  assert.equal(checked.service_percent, 10.3233)
  const subtotal = receiptSubtotal(checked.items)
  assert.equal(subtotal, 959)
  assert.equal(Math.round(billTotal(checked, subtotal) * 100) / 100, 1058)
})

test('service worked out on full prices, before the free drink, still adds up', () => {
  const checked = checkScan({ ...coffeeClub, service_amount: 98.9 })
  assert.equal(checked.tax_percent, 0)
  assert.equal(checked.service_percent, 10.3128)
  assert.equal(Math.round(billTotal(checked, receiptSubtotal(checked.items)) * 100) / 100, 1057.9)
})

test('the printed service amount is ignored when the items still do not add up', () => {
  const missingJuice = { ...coffeeClub, items: coffeeClub.items.filter((item) => item.unit_price !== 30) }
  assert.equal(checkScan(missingJuice), missingJuice)
})

test('a service amount that already matches the percent changes nothing', () => {
  const plain = { ...coffeeClub, service_amount: 95.9, total: 1054.9 }
  assert.deepEqual(checkScan(plain), { ...plain, tax_percent: 0 })
})

test('money shows the currency symbol, as phones skip narrowSymbol', () => {
  assert.equal(formatMoney(1791.98, 'THB'), '฿1,791.98')
  assert.equal(formatMoney(-3, 'THB'), '-฿3.00')
  assert.equal(formatMoney(12, 'usd'), '$12.00')
  assert.equal(formatMoney(5, 'MYR'), 'RM5.00')
  assert.equal(formatMoney(5, 'XYZ'), 'XYZ 5.00')
})

const withPromo = [
  { id: 'steak', qty: 1, unit_price: 600 },
  { id: 'salad', qty: 1, unit_price: 200 },
  { id: 'promo', qty: 1, unit_price: -80 },
]
const promoBill = { subtotal: 720, tax_percent: 7, service_percent: 10, rounding: 0 }

test('a whole-bill promotion is shared by what each person had', () => {
  const split = splitByPicks(promoBill, withPromo, ['me', 'friend'], { steak: { me: 1 }, salad: { friend: 1 } })
  assert.equal(split.people.me.discount, -60)
  assert.equal(split.people.friend.discount, -20)
  assert.equal(split.people.me.subtotal, 540)
  assert.equal(split.people.friend.subtotal, 180)
  assert.ok(Math.abs(split.people.me.total + split.people.friend.total - billTotal(promoBill, 720)) < 0.001)
  assert.equal(split.unassigned.total, 0)
})

test('a promotion picked for someone comes off only their share, even if they had nothing else', () => {
  assert.deepEqual(itemShares(withPromo[2], []), { shares: {}, left: 0, unclaimed: 0 })
  const split = splitByPicks(promoBill, withPromo, ['me', 'friend'], { steak: { me: 1 }, promo: { friend: 1 } })
  assert.equal(split.people.me.discount, 0)
  assert.equal(split.people.me.subtotal, 600)
  assert.equal(split.people.friend.discount, -80)
  assert.equal(split.people.friend.subtotal, -80)
  assert.equal(split.unassigned.subtotal, 200)
  assert.equal(split.unassigned.discount, 0)
})

test('a promotion with nothing picked waits with the rest of the bill', () => {
  const split = splitByPicks(promoBill, withPromo, ['me'], {})
  assert.equal(split.people.me.total, 0)
  assert.equal(split.unassigned.subtotal, 720)
})

test('a share split between people goes back to the rest of the bill', () => {
  const { shares, left, unclaimed } = itemShares({ id: 'a', qty: 1, unit_price: 150 }, ['me'], { me: 1 }, { me: 5 })
  assert.equal(shares.me, 30)
  assert.equal(left, 0)
  assert.equal(unclaimed, 120)
})

test('split between keeps the bill adding up', () => {
  const result = splitByPicks(
    { subtotal: 300, tax_percent: 0, service_percent: 10, rounding: 0 },
    [
      { id: 'a', qty: 1, unit_price: 150 },
      { id: 'b', qty: 1, unit_price: 150 },
    ],
    ['me'],
    { a: { me: 1 } },
    { a: { me: 3 } },
  )
  assert.equal(result.people.me.subtotal, 50)
  assert.ok(Math.abs(result.people.me.total + result.unassigned.total - 330) < 1e-9)
})

test('a discount given to one person comes off only their share', () => {
  const bill = { subtotal: 959, tax_percent: 0, service_percent: 10, rounding: 0 }
  const items = [
    { id: 'crab', qty: 1, unit_price: 959 },
    { id: 'juice', qty: 1, unit_price: 30 },
    { id: 'free', qty: 1, unit_price: -30 },
  ]
  const shared = splitByPicks(bill, items, ['ye', 'anna'], { crab: { ye: 1 }, juice: { anna: 1 } })
  assert.ok(Math.abs(shared.people.anna.subtotal - (30 - (30 * 30) / 989)) < 1e-9)
  const toAnna = splitByPicks(bill, items, ['ye', 'anna'], { crab: { ye: 1 }, juice: { anna: 1 }, free: { anna: 1 } })
  assert.equal(toAnna.people.anna.subtotal, 0)
  assert.equal(toAnna.people.anna.total, 0)
  assert.equal(toAnna.people.ye.subtotal, 959)
  assert.equal(toAnna.people.anna.discount, -30)
  assert.ok(Math.abs(toAnna.people.ye.total + toAnna.people.anna.total - 959 * 1.1) < 1e-9)
})

test('a discount given to several people is split evenly between them', () => {
  const bill = { subtotal: 80, tax_percent: 0, service_percent: 0, rounding: 0 }
  const items = [
    { id: 'a', qty: 1, unit_price: 50 },
    { id: 'b', qty: 1, unit_price: 50 },
    { id: 'deal', qty: 1, unit_price: -20 },
  ]
  const result = splitByPicks(bill, items, ['me', 'ben', 'kris'], {
    a: { me: 1 },
    b: { ben: 1 },
    deal: { me: 1, kris: 1, gone: 1 },
  })
  assert.equal(result.people.me.total, 40)
  assert.equal(result.people.ben.total, 50)
  assert.equal(result.people.kris.total, -10)
  assert.deepEqual(itemShares(items[2], ['me', 'kris']).shares, { me: -10, kris: -10 })
})
