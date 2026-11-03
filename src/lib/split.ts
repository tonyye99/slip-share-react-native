import { strings } from '../i18n/strings.ts'

export interface SplitItem {
  id: string
  qty: number
  unit_price: number
}

export interface SplitReceipt {
  subtotal: number
  tax_percent: number
  service_percent: number
  rounding: number
  tax_on_items_only?: boolean
}

export interface SplitResult {
  subtotal: number
  tax: number
  service: number
  rounding: number
  total: number
  proportion: number
}

type Charges = Pick<SplitReceipt, 'service_percent' | 'tax_percent' | 'tax_on_items_only'>

export function chargesFor(receipt: Charges, items: number): { service: number; tax: number } {
  const service = (receipt.service_percent / 100) * items
  const tax = (receipt.tax_percent / 100) * (receipt.tax_on_items_only ? items : items + service)
  return { service, tax }
}

function chargesOn(receipt: SplitReceipt, subtotal: number): SplitResult {
  const proportion = receipt.subtotal > 0 ? subtotal / receipt.subtotal : 0
  const { service, tax } = chargesFor(receipt, subtotal)
  const rounding = receipt.rounding * proportion

  return {
    subtotal,
    tax,
    service,
    rounding,
    total: subtotal + tax + service + rounding,
    proportion,
  }
}

export type Assignments = Record<string, string[]>

export type Counts = Record<string, Record<string, number>>

export const isCountable = (item: Pick<SplitItem, 'qty'>) => Number.isInteger(item.qty) && item.qty >= 2

export const evenCount = (item: Pick<SplitItem, 'qty'>, people: number) =>
  isCountable(item) && people > 0 ? Math.ceil(item.qty / people) : 1

export function itemShares(
  item: SplitItem,
  personIds: string[],
  counts: Record<string, number> = {},
): { shares: Record<string, number>; left: number } {
  const countOf = (personId: string) => (isCountable(item) ? (counts[personId] ?? 1) : 1)
  const claimed = personIds.reduce((sum, personId) => sum + countOf(personId), 0)
  const lineTotal = item.qty * item.unit_price
  const left = isCountable(item) ? Math.max(0, item.qty - claimed) : personIds.length > 0 ? 0 : item.qty
  const paidFor = item.qty - left
  return {
    shares: Object.fromEntries(
      personIds.map((personId) => [personId, claimed > 0 ? (lineTotal * (paidFor / item.qty) * countOf(personId)) / claimed : 0]),
    ),
    left,
  }
}

export interface PeopleSplit {
  people: Record<string, SplitResult>
  unassigned: SplitResult
}

export function splitByPerson(
  receipt: SplitReceipt,
  items: SplitItem[],
  personIds: string[],
  assignments: Assignments,
  counts: Counts = {},
): PeopleSplit {
  const subtotals: Record<string, number> = Object.fromEntries(personIds.map((personId) => [personId, 0]))
  let unassigned = 0
  for (const item of items) {
    const { shares, left } = itemShares(item, assignments[item.id] ?? [], counts[item.id])
    for (const [personId, share] of Object.entries(shares)) {
      if (personId in subtotals) subtotals[personId] += share
    }
    unassigned += left * item.unit_price
  }

  return {
    people: Object.fromEntries(personIds.map((personId) => [personId, chargesOn(receipt, subtotals[personId])])),
    unassigned: chargesOn(receipt, unassigned),
  }
}

export const picksFrom = (items: { id: string; receipt_item_people: { person_id: string; units: number }[] }[]): Counts =>
  Object.fromEntries(
    items.map((item) => [item.id, Object.fromEntries(item.receipt_item_people.map((row) => [row.person_id, row.units]))]),
  )

export function splitByPicks(receipt: SplitReceipt, items: SplitItem[], personIds: string[], picks: Counts): PeopleSplit {
  const assignments = Object.fromEntries(Object.entries(picks).map(([itemId, had]) => [itemId, Object.keys(had)]))
  return splitByPerson(receipt, items, personIds, assignments, picks)
}

export const peopleInOrder = <T extends { is_me: boolean; created_at: string }>(people: T[]): T[] =>
  [...people].sort((a, b) => Number(b.is_me) - Number(a.is_me) || a.created_at.localeCompare(b.created_at))

export function receiptSubtotal(items: Pick<SplitItem, 'qty' | 'unit_price'>[]): number {
  return items.reduce((sum, item) => sum + item.qty * item.unit_price, 0)
}

export function billTotal(receipt: Omit<SplitReceipt, 'subtotal'>, subtotal: number): number {
  const { service, tax } = chargesFor(receipt, subtotal)
  return subtotal + service + tax + receipt.rounding
}

const addsUpTo = (receipt: Omit<SplitReceipt, 'subtotal'>, subtotal: number, total: number) =>
  Math.abs(billTotal(receipt, subtotal) - total) < 0.5

function asPrintedTax<T extends Charges>(receipt: T): T {
  if (receipt.service_percent <= 0 || receipt.tax_percent <= 0) return receipt
  const printed = receipt.tax_percent / (1 + receipt.service_percent / 100)
  const rounded = Math.round(printed * 1000) / 1000
  return Math.abs(printed - rounded) < 1e-6 ? { ...receipt, tax_percent: rounded } : receipt
}

const onItemsOnly = <T extends Charges>(receipt: T): T =>
  receipt.service_percent > 0 && receipt.tax_percent > 0 ? { ...receipt, tax_on_items_only: true } : receipt

export function readSavedCharges<T extends SplitReceipt & { total: number }>(receipt: T): T {
  const matches = (r: T) => addsUpTo(r, receipt.subtotal, receipt.total)
  if (receipt.total <= 0 || matches(receipt)) return receipt
  return [asPrintedTax(receipt), onItemsOnly(receipt)].find((r) => r !== receipt && matches(r)) ?? receipt
}

export function dropIncludedCharges<T extends Omit<SplitReceipt, 'subtotal'> & { total: number }>(
  receipt: T,
  subtotal: number,
): T {
  const matchesTotal = (r: T) => addsUpTo(r, subtotal, receipt.total)
  if (receipt.total <= 0 || matchesTotal(receipt)) return receipt
  const alternatives = [
    asPrintedTax(receipt),
    onItemsOnly(receipt),
    { ...receipt, tax_percent: 0 },
    { ...receipt, service_percent: 0 },
    { ...receipt, tax_percent: 0, service_percent: 0 },
  ]
  return alternatives.find((r) => r !== receipt && matchesTotal(r)) ?? receipt
}

type ScannedReceipt = Omit<SplitReceipt, 'subtotal'> & { total: number; items: Omit<SplitItem, 'id'>[] }

export function checkScan<T extends ScannedReceipt>(receipt: T): T {
  const settle = (r: T) => dropIncludedCharges(r, receiptSubtotal(r.items))
  const matchesTotal = (r: T) => addsUpTo(r, receiptSubtotal(r.items), r.total)
  const asRead = settle(receipt)
  if (receipt.total <= 0 || matchesTotal(asRead) || !receipt.items.some((item) => item.qty > 1)) return asRead
  const asLineTotals = settle({
    ...receipt,
    items: receipt.items.map((item) =>
      item.qty > 1 ? { ...item, unit_price: Math.round((item.unit_price / item.qty) * 100) / 100 } : item,
    ),
  })
  return matchesTotal(asLineTotals) ? asLineTotals : asRead
}

const SYMBOLS: Record<string, string> = {
  THB: '฿', USD: '$', SGD: '$', AUD: '$', CAD: '$', HKD: '$', TWD: '$', NZD: '$', MXN: '$',
  EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', KRW: '₩', INR: '₹', PHP: '₱', VND: '₫', ILS: '₪',
  NGN: '₦', UAH: '₴', MYR: 'RM', IDR: 'Rp', BRL: 'R$', CHF: 'CHF ', ZAR: 'R', TRY: '₺', PLN: 'zł ',
}

export function formatMoney(amount: number, currency: string): string {
  const code = currency.toUpperCase()
  try {
    const text = new Intl.NumberFormat('en-US', { style: 'currency', currency: code, currencyDisplay: 'code' }).format(amount)
    const symbol = SYMBOLS[code]
    return symbol ? text.replace(new RegExp(`${code}\\s*`), symbol) : text.replace(new RegExp(`${code}\\s*`), `${code} `)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export interface TotalsLine {
  name: string
  total: number
  subtotal: number
  items: string[]
  paid: boolean
}

function plainAmount(amount: number): string {
  const cents = Math.round(amount * 100)
  const whole = cents % 100 === 0
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })
}

function mathsOf(person: TotalsLine): string {
  if (person.subtotal < 0.005) return ''
  const factor = Number((person.total / person.subtotal).toFixed(4))
  return factor === 1 ? '' : `${plainAmount(person.subtotal)} × ${factor}`
}

export function totalsMessage(bill: {
  title: string
  currency: string
  total: number
  service_percent: number
  tax_percent: number
  payer: string | null
  people: TotalsLine[]
  unassigned: number
  maths?: boolean
}): string {
  const t = strings().totals
  const money = (amount: number) => formatMoney(amount, bill.currency)
  const charges = [
    bill.service_percent > 0 ? t.service(bill.service_percent) : null,
    bill.tax_percent > 0 ? t.tax(bill.tax_percent) : null,
  ].filter((charge) => charge !== null)

  const lines = [`${bill.title}: ${money(bill.total)}`]
  if (bill.payer) lines.push(t.paidBy(bill.payer))
  lines.push('')
  for (const person of bill.people) {
    const maths = bill.maths ? mathsOf(person) : ''
    const items = person.items.join(', ')
    lines.push(
      `${person.name}: ${money(person.total)}${bill.payer && person.paid ? t.paid : ''}` +
        (items ? ` - ${items}` : '') +
        (maths ? ` (${maths})` : ''),
    )
  }
  if (Math.abs(bill.unassigned) >= 0.005) lines.push(t.notAssigned(money(bill.unassigned)))
  if (charges.length > 0) lines.push('', t.includes(charges))
  return lines.join('\n')
}

export function myShareMessage(bill: {
  title: string
  currency: string
  me: TotalsLine
  payer: string
  maths?: boolean
}): string {
  const t = strings().totals
  const items = bill.me.items.join(', ')
  const maths = bill.maths ? mathsOf(bill.me) : ''
  const lines = [t.myShare(bill.title, formatMoney(bill.me.total, bill.currency))]
  if (items || maths) lines.push([items, maths ? `(${maths})` : ''].filter(Boolean).join(' '))
  lines.push(t.sentTo(bill.payer))
  return lines.join('\n')
}
