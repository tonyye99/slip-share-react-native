import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  alignTo,
  better,
  describe,
  fromLines,
  groupLines,
  missBy,
  readsRight,
  recheckNote,
  trustedColumn,
  withServiceAmount,
  type NameLine,
  type Reading,
  type ScanItem,
} from './check.ts'

const lines = (...amounts: number[]) => amounts.map((line_total) => ({ line_total }))

const coffeeClub: Reading = {
  is_receipt: true,
  price_column: [270, 270, 59, 140, 220, 30, -30],
  items: lines(270, 270, 59, 140, 220, 30, -30),
  total: 1058,
  service_percent: 10,
  service_amount: 99,
  tax_percent: 7,
  rounding: 0,
}

const droppedJuice: Reading = {
  ...coffeeClub,
  price_column: [270, 270, 59, 140, 220, 30, -30],
  items: lines(270, 270, 59, 140, 220, -30),
}

const doubledTea: Reading = {
  ...coffeeClub,
  price_column: [270, 270, 59, 59, 140, 220, 30, -30],
  items: lines(270, 270, 59, 59, 140, 220, 30, -30),
}

test('a reading whose items fit the printed total and service is right', () => {
  assert.equal(readsRight(coffeeClub), true)
  assert.equal(missBy(coffeeClub), 0)
})

test('a dropped line is caught by the total', () => {
  assert.equal(readsRight({ ...droppedJuice, price_column: [] }), false)
})

test('a dropped line is caught by the price column count', () => {
  assert.equal(readsRight({ ...droppedJuice, total: 1028 }), false)
})

test('service and VAT added on top still count as fitting', () => {
  const onTop = { ...coffeeClub, service_amount: 0, total: 959 * 1.1 * 1.07 }
  assert.equal(readsRight(onTop), true)
})

test('not a receipt is never re-read', () => {
  assert.equal(readsRight({ ...droppedJuice, is_receipt: false }), true)
})

test('the re-read note says what did not fit', () => {
  assert.equal(
    recheckNote(droppedJuice, null),
    'A first reading of this receipt found 6 items adding up to 929.00, with 7 amounts in the price column. That does not fit the printed total of 1058.00 and a service charge of 99.00. A line was probably dropped, merged with the next one, or matched to the wrong amount. Read the items again slowly, from the top, matching every amount in the price column to its own name.',
  )
})

test('the second reading wins when it fits, or misses by less', () => {
  assert.equal(better(droppedJuice, coffeeClub), coffeeClub)
  const worse = { ...droppedJuice, items: lines(270, 270) }
  assert.equal(better(droppedJuice, worse), droppedJuice)
  assert.equal(better(droppedJuice, { ...coffeeClub, is_receipt: false }), droppedJuice)
})

test('an amount read twice in a row is caught, and the price column without it is trusted', () => {
  assert.equal(readsRight(doubledTea), false)
  assert.equal(missBy(doubledTea), 59)
  assert.deepEqual(trustedColumn(doubledTea), [270, 270, 59, 140, 220, 30, -30])
})

test('a price column that fits the total is trusted as read', () => {
  assert.deepEqual(trustedColumn(droppedJuice), droppedJuice.price_column)
})

test('a price column that cannot be made to fit is not trusted', () => {
  assert.equal(trustedColumn({ ...droppedJuice, price_column: [270, 270, 59, 140, 220, -30] }), null)
  assert.equal(trustedColumn({ ...droppedJuice, price_column: [] }), null)
  assert.equal(trustedColumn({ ...droppedJuice, is_receipt: false }), null)
})

test('items get the trusted amounts in order when the count matches', () => {
  const column = [270, 270, 59, 140, 220, 30, -30]
  const shifted = { ...coffeeClub, items: lines(270, 270, 59, 59, 140, 220, -30) }
  const aligned = alignTo(shifted, column)
  assert.deepEqual(
    aligned.items.map((item) => item.line_total),
    column,
  )
  assert.equal(readsRight(aligned), true)
  assert.equal(alignTo(doubledTea, column), doubledTea)
  assert.equal(alignTo(doubledTea, null), doubledTea)
})

test('the re-read note gives the trusted amounts and the one read twice', () => {
  assert.equal(
    recheckNote(doubledTea, trustedColumn(doubledTea)),
    'The price column of this receipt has exactly 7 amounts, top to bottom: 270.00, 270.00, 59.00, 140.00, 220.00, 30.00, -30.00. They fit the printed total of 1058.00 and a service charge of 99.00. A first reading listed 59.00 twice in a row, but it is printed only once. A first reading found 8 items, so some name lines were split off, merged or dropped. Give exactly 7 items, one for each of these amounts, in this order, with these line_totals, and use these amounts as price_column. In name_lines, mark exactly 7 lines with starts_item true, one for each amount. Every other line in the item list is part of an item name: a second line, often indented, belongs to the item it continues. A number inside a name, like the 59 in "Add on Drink 59 THB", is part of the name, not an amount.',
  )
  assert.doesNotMatch(recheckNote(droppedJuice, droppedJuice.price_column), /twice/)
})

test('the log line says how a reading did', () => {
  assert.equal(describe(doubledTea), '8 items for 8 prices, 59.00 off the total')
})

test('a reading that missed the printed service amount is still checked against service on full prices', () => {
  const noServiceAmount = { ...doubledTea, service_amount: 0 }
  assert.equal(describe(noServiceAmount), '8 items for 8 prices, 61.80 off the total')
  assert.deepEqual(trustedColumn(noServiceAmount), [270, 270, 59, 140, 220, 30, -30])
  assert.equal(readsRight({ ...coffeeClub, service_amount: 0 }), true)
})

test('service charged before discounts is filled in as the service amount', () => {
  assert.equal(withServiceAmount({ ...coffeeClub, service_amount: 0 }).service_amount, 98.9)
  assert.equal(withServiceAmount(coffeeClub), coffeeClub)
  const noDiscount = { ...coffeeClub, service_amount: 0, items: lines(270, 270, 59, 140, 220, 30), total: 1087.9 }
  assert.equal(withServiceAmount(noDiscount), noDiscount)
  const offTotal = { ...doubledTea, service_amount: 0 }
  assert.equal(withServiceAmount(offTotal), offTotal)
})

const start = (text: string): NameLine => ({ text, starts_item: true })
const more = (text: string): NameLine => ({ text, starts_item: false })
const printedLines = [
  start('HH_YellowChilli Crab'),
  start('HH_Curry Crab'),
  start('Add on Drink 59 THB'),
  more('Iced Thai Tea'),
  start('Iced Latte'),
  more('SIAM_BLEND'),
  start('Salt chili crispy pork'),
  start('Welcome Pack'),
  more('TahitiLemonJuice'),
  start('Free Drink min 100'),
]
const named = (...pairs: [string, number][]): ScanItem[] =>
  pairs.map(([name, line_total], i) => ({ id: String(i + 1), name, qty: 1, line_total }))
const column = [270, 270, 59, 140, 220, 30, -30]
const rightNames = [
  'HH_YellowChilli Crab',
  'HH_Curry Crab',
  'Add on Drink 59 THB Iced Thai Tea',
  'Iced Latte SIAM_BLEND',
  'Salt chili crispy pork',
  'Welcome Pack TahitiLemonJuice',
  'Free Drink min 100',
]

test('name lines group into one name per item', () => {
  assert.deepEqual(
    groupLines(printedLines).map((group) => group.map((line) => line.text).join(' ')),
    rightNames,
  )
  assert.deepEqual(groupLines([more('Tea'), more('Large'), start(' '), start('Cake')]).length, 2)
})

test('names that slid a row are put back from the name lines', () => {
  const slid = {
    ...coffeeClub,
    name_lines: printedLines,
    items: named(
      ['HH YellowChilli Crab', 270],
      ['HH Curry Crab', 270],
      ['Add on Drink 59 THB Iced Thai Tea Iced Latte SIAM_BLEND', 59],
      ['Salt chili crispy pork', 140],
      ['Welcome Pack TahitiLemonJuice', 220],
      ['TahitiLemonJuice', 30],
      ['Free Drink min 100', -30],
    ),
  }
  assert.equal(readsRight(slid), true)
  const fixed = fromLines(slid, column)
  assert.deepEqual(
    fixed.items.map((item) => [item.name, item.line_total]),
    rightNames.map((name, i) => [name, column[i]]),
  )
  assert.equal(readsRight(fixed), true)
})

test('an extra item from an amount read twice is fixed from the name lines', () => {
  const doubled = {
    ...doubledTea,
    name_lines: printedLines,
    items: named(
      ['HH_YellowChilli Crab', 270],
      ['HH_Curry Crab', 270],
      ['Add on Drink 59 THB Iced Thai Tea', 59],
      ['Iced Latte SIAM_BLEND', 59],
      ['Salt chili crispy pork', 140],
      ['Welcome Pack', 220],
      ['TahitiLemonJuice', 30],
      ['Free Drink min 100', -30],
    ),
  }
  assert.equal(readsRight(doubled), false)
  const fixed = fromLines(doubled, trustedColumn(doubled))
  assert.deepEqual(
    fixed.items.map((item) => item.name),
    rightNames,
  )
  assert.equal(readsRight(fixed), true)
})

test('items that already match the name lines keep their names and get the amounts in order', () => {
  const right = { ...coffeeClub, name_lines: printedLines, items: named(...rightNames.map((name): [string, number] => [name.replace('_', ' '), 1])) }
  const fixed = fromLines(right, column)
  assert.deepEqual(
    fixed.items.map((item) => [item.name, item.line_total]),
    right.items.map((item, i) => [item.name, column[i]]),
  )
})

test('name lines that do not fit the amounts change nothing and ask for a second read', () => {
  const tooMany = { ...coffeeClub, name_lines: [...printedLines, start('Extra line')], items: named(...rightNames.map((name, i): [string, number] => [name, column[i]])) }
  assert.deepEqual(fromLines(tooMany, column).items, tooMany.items)
  const shuffled = { ...tooMany, items: named(...rightNames.map((name): [string, number] => [name, 1])) }
  assert.deepEqual(
    fromLines(shuffled, column).items.map((item) => item.line_total),
    column,
  )
  assert.equal(readsRight(tooMany), false)
  assert.match(recheckNote(tooMany, column), /marked 8 name lines as starting an item/)
  assert.equal(describe(tooMany), '7 items for 7 prices, 8 name groups, 0.00 off the total')
  assert.equal(fromLines({ ...tooMany, name_lines: printedLines }, null).items, tooMany.items)
})

test('rebuilt items keep the quantity and get English names from the lines', () => {
  const reading = {
    ...coffeeClub,
    price_column: [120, 50],
    total: 170,
    service_percent: 0,
    service_amount: 0,
    tax_percent: 0,
    name_lines: [
      { text: 'ข้าวผัด', text_en: 'Fried rice', starts_item: true },
      { text: 'กุ้ง', text_en: 'shrimp', starts_item: false },
      { text: 'โค้ก', text_en: 'Coke', starts_item: true },
    ],
    items: [
      { id: '1', name: 'ข้าวผัด', name_en: 'Fried rice', qty: 1, line_total: 50 },
      { id: '2', name: 'กุ้ง โค้ก', name_en: 'Shrimp Coke', qty: 2, line_total: 120 },
    ],
  }
  const fixed = fromLines(reading, trustedColumn(reading))
  assert.deepEqual(fixed.items, [
    { id: '1', name: 'ข้าวผัด กุ้ง', name_en: 'Fried rice shrimp', qty: 1, line_total: 120 },
    { id: '2', name: 'โค้ก', name_en: 'Coke', qty: 2, line_total: 50 },
  ])
})
