// Bill-splitting math, ported from slip-share's cost-calculator and selections API.
// Tax and service apply to the person's share of items; rounding is split
// in proportion to their share of the receipt subtotal. An item several
// people had is divided evenly between them, unless they say how many of a
// line they each had (see itemShares).

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

/** Someone's items plus their part of tax, service and rounding. */
function chargesOn(receipt: SplitReceipt, subtotal: number): SplitResult {
  const proportion = receipt.subtotal > 0 ? subtotal / receipt.subtotal : 0
  const tax = (receipt.tax_percent / 100) * subtotal
  const service = (receipt.service_percent / 100) * subtotal
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

export function receiptSubtotal(items: Pick<SplitItem, 'qty' | 'unit_price'>[]): number {
  return items.reduce((sum, item) => sum + item.qty * item.unit_price, 0)
}

/** What the whole bill comes to: items plus service, tax and rounding. */
export function billTotal(receipt: Omit<SplitReceipt, 'subtotal'>, subtotal: number): number {
  return subtotal + (subtotal * receipt.service_percent) / 100 + (subtotal * receipt.tax_percent) / 100 + receipt.rounding
}

/**
 * Receipts often print VAT or a service charge that is already inside the item
 * prices ("VAT included"). If the charges as read don't reach the printed total
 * but leaving some of them out does, those were included, so they're dropped.
 */
export function dropIncludedCharges<T extends Omit<SplitReceipt, 'subtotal'> & { total: number }>(
  receipt: T,
  subtotal: number,
): T {
  const matchesTotal = (r: T) => Math.abs(billTotal(r, subtotal) - receipt.total) < 0.5
  if (receipt.total <= 0 || matchesTotal(receipt)) return receipt
  const withoutCharges = [
    { ...receipt, tax_percent: 0 },
    { ...receipt, service_percent: 0 },
    { ...receipt, tax_percent: 0, service_percent: 0 },
  ]
  return withoutCharges.find(matchesTotal) ?? receipt
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
  const matchesTotal = (r: T) => Math.abs(billTotal(r, receiptSubtotal(r.items)) - r.total) < 0.5
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
  /** Has paid the payer back. */
  paid: boolean
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
}): string {
  const money = (amount: number) => formatMoney(amount, bill.currency)
  const charges = [
    bill.service_percent > 0 ? `${bill.service_percent}% service` : null,
    bill.tax_percent > 0 ? `${bill.tax_percent}% tax` : null,
  ].filter((charge) => charge !== null)

  const lines = [`${bill.title}: ${money(bill.total)}`]
  if (bill.payer) lines.push(`Paid by ${bill.payer}.`)
  lines.push('')
  for (const person of bill.people) {
    lines.push(`${person.name}: ${money(person.total)}${bill.payer && person.paid ? ' (paid)' : ''}`)
  }
  if (Math.abs(bill.unassigned) >= 0.005) lines.push(`Not assigned yet: ${money(bill.unassigned)}`)
  if (charges.length > 0) lines.push('', `Includes ${charges.join(' and ')}.`)
  return lines.join('\n')
}
