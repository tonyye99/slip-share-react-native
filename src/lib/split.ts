// Bill-splitting math, ported from slip-share's cost-calculator and selections API.
// Tax and service apply to the person's share of items; rounding is split
// in proportion to their share of the receipt subtotal.

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

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}
