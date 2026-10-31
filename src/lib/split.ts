// Bill-splitting math, ported from slip-share's cost-calculator and selections API.
// Service and tax apply to the person's share of items, tax on top of the
// service charge (see chargesFor); rounding is split in proportion to their
// share of the receipt subtotal. An item several
// people had is divided evenly between them, unless they say how many of a
// line they each had (see itemShares).

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
  /**
   * Tax is on the item prices alone, not on the service charge as well. Not
   * saved: it's worked out from the printed total (see readSavedCharges).
   */
  tax_on_items_only?: boolean
}

export interface SplitResult {
  subtotal: number
  tax: number
  service: number
  rounding: number
  total: number
  /** Share of the receipt subtotal, 0–1. */
  proportion: number
}

export function itemCostPerPerson(item: SplitItem, shareCount: number | undefined): number {
  return (item.qty * item.unit_price) / (shareCount || 1)
}

export function calculateSplit(
  receipt: SplitReceipt,
  items: SplitItem[],
  selectedItemIds: string[],
  shareCounts: Record<string, number>,
): SplitResult {
  const selected = new Set(selectedItemIds)
  const subtotal = items
    .filter((item) => selected.has(item.id))
    .reduce((sum, item) => sum + itemCostPerPerson(item, shareCounts[item.id]), 0)

  return chargesOn(receipt, subtotal)
}

type Charges = Pick<SplitReceipt, 'service_percent' | 'tax_percent' | 'tax_on_items_only'>

/**
 * The service charge and tax on an amount of items. Tax (VAT, GST, sales tax)
 * is usually charged on the service charge too, as on bills that print
 * "Service 10%" and then "VAT 7%" of the new amount, so 10% and 7% come to 17.7%.
 */
export function chargesFor(receipt: Charges, items: number): { service: number; tax: number } {
  const service = (receipt.service_percent / 100) * items
  const tax = (receipt.tax_percent / 100) * (receipt.tax_on_items_only ? items : items + service)
  return { service, tax }
}

/** Someone's items plus their part of tax, service and rounding. */
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

/** Who had each item: item id -> ids of the people who shared it. */
export type Assignments = Record<string, string[]>

/** How many of a line each person had: item id -> person id -> count. A missing count is 1. */
export type Counts = Record<string, Record<string, number>>

/** Lines like "2 × Egg Kim Bab" can be split by how many each person had. */
export const isCountable = (item: Pick<SplitItem, 'qty'>) => Number.isInteger(item.qty) && item.qty >= 2

/** Everyone's count when people share a line evenly: enough each that none is left over. */
export const evenCount = (item: Pick<SplitItem, 'qty'>, people: number) =>
  isCountable(item) && people > 0 ? Math.ceil(item.qty / people) : 1

/**
 * What one line costs each person on it, and how many of it nobody has
 * claimed. On a countable line each person pays for as many as they had; if
 * that adds up to more than the line, as when people share a dish, the line is
 * divided in proportion instead. Other lines are shared evenly.
 */
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
  /** Person id -> their items plus their part of service, tax and rounding. */
  people: Record<string, SplitResult>
  /** Items nobody has been ticked on yet. */
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

/** Who had each line as the database stores it, as item id -> person id -> count. */
export const picksFrom = (items: { id: string; receipt_item_people: { person_id: string; units: number }[] }[]): Counts =>
  Object.fromEntries(
    items.map((item) => [item.id, Object.fromEntries(item.receipt_item_people.map((row) => [row.person_id, row.units]))]),
  )

/** splitByPerson for picks with counts: everyone with a count on a line had it. */
export function splitByPicks(receipt: SplitReceipt, items: SplitItem[], personIds: string[], picks: Counts): PeopleSplit {
  const assignments = Object.fromEntries(Object.entries(picks).map(([itemId, had]) => [itemId, Object.keys(had)]))
  return splitByPerson(receipt, items, personIds, assignments, picks)
}

/** You first, then everyone else in the order they were added. */
export const peopleInOrder = <T extends { is_me: boolean; created_at: string }>(people: T[]): T[] =>
  [...people].sort((a, b) => Number(b.is_me) - Number(a.is_me) || a.created_at.localeCompare(b.created_at))

export function receiptSubtotal(items: Pick<SplitItem, 'qty' | 'unit_price'>[]): number {
  return items.reduce((sum, item) => sum + item.qty * item.unit_price, 0)
}

/** What the whole bill comes to: items plus service, tax and rounding. */
export function billTotal(receipt: Omit<SplitReceipt, 'subtotal'>, subtotal: number): number {
  const { service, tax } = chargesFor(receipt, subtotal)
  return subtotal + service + tax + receipt.rounding
}

const addsUpTo = (receipt: Omit<SplitReceipt, 'subtotal'>, subtotal: number, total: number) =>
  Math.abs(billTotal(receipt, subtotal) - total) < 0.5

/**
 * The tax rate as printed, for a rate given as a share of the items alone:
 * 7% VAT on top of 10% service is 7.7% of the items. Scans sometimes report
 * that, and bills saved before chargesFor charged tax on service kept it.
 */
function asPrintedTax<T extends Charges>(receipt: T): T {
  if (receipt.service_percent <= 0 || receipt.tax_percent <= 0) return receipt
  const printed = receipt.tax_percent / (1 + receipt.service_percent / 100)
  // Printed rates are round numbers like 7 or 8.875. Anything else (7% read as
  // 6.3636…) means the tax really was on the items alone, so it stays as read.
  const rounded = Math.round(printed * 1000) / 1000
  return Math.abs(printed - rounded) < 1e-6 ? { ...receipt, tax_percent: rounded } : receipt
}

/** Tax on the items alone, for bills whose total only adds up that way. */
const onItemsOnly = <T extends Charges>(receipt: T): T =>
  receipt.service_percent > 0 && receipt.tax_percent > 0 ? { ...receipt, tax_on_items_only: true } : receipt

/**
 * How a saved bill's tax was charged, worked out from its total: on the
 * service charge too unless only the items add up. Bills saved before tax was
 * charged on service may have it as a share of the items, which is put back
 * to the printed rate.
 */
export function readSavedCharges<T extends SplitReceipt & { total: number }>(receipt: T): T {
  const matches = (r: T) => addsUpTo(r, receipt.subtotal, receipt.total)
  if (receipt.total <= 0 || matches(receipt)) return receipt
  return [asPrintedTax(receipt), onItemsOnly(receipt)].find((r) => r !== receipt && matches(r)) ?? receipt
}

/**
 * Receipts often print VAT or a service charge that is already inside the item
 * prices ("VAT included"). If the charges as read don't reach the printed total
 * but leaving some of them out does, those were included, so they're dropped.
 * A tax rate read as a share of the items alone is put back to the printed one.
 */
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

/**
 * Checks a scan against the total printed on the receipt. Lines like
 * "2  Ramen  320" print what the whole line costs, but scans sometimes read 320
 * as the price of one. If the items as read can't reach the printed total and
 * reading those prices as line totals can, they're divided by the quantity.
 * Charges already included in the prices are dropped as in dropIncludedCharges.
 */
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

export function formatMoney(amount: number, currency: string): string {
  try {
    // narrowSymbol shows ฿1,005.16 rather than THB 1,005.16.
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export interface TotalsLine {
  name: string
  total: number
  /** Their items before service, tax and rounding. */
  subtotal: number
  /** What they had, like "Pad thai" or "Som tam ½". */
  items: string[]
  /** Has paid the payer back. */
  paid: boolean
}

/** An amount without its currency, like 335 or 144.50, for the maths. */
function plainAmount(amount: number): string {
  const cents = Math.round(amount * 100)
  const whole = cents % 100 === 0
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })
}

/** How someone's items come to their total, like "335 × 1.177". Empty with no charges. */
function mathsOf(person: TotalsLine): string {
  if (person.subtotal < 0.005) return ''
  const factor = Number((person.total / person.subtotal).toFixed(4))
  return factor === 1 ? '' : `${plainAmount(person.subtotal)} × ${factor}`
}

/** The text "Send totals" shares to LINE, WhatsApp and the like. */
export function totalsMessage(bill: {
  title: string
  currency: string
  total: number
  service_percent: number
  tax_percent: number
  /** Who paid the bill, or null if nobody is picked. */
  payer: string | null
  people: TotalsLine[]
  unassigned: number
  /** Adds how each total is worked out, like "(335 × 1.177)". */
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

/**
 * "Just me" on a bill someone else paid: what you had, how it adds up and
 * that you've sent the payer your share.
 */
export function myShareMessage(bill: {
  title: string
  currency: string
  me: TotalsLine
  /** Who paid. */
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
