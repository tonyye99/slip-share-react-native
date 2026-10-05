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

export function itemShare(item: SplitItem, shareCount: number | undefined): number {
  return (item.qty * item.unit_price) / (shareCount || 1)
}

export function calculateSplit(
  receipt: SplitReceipt,
  items: SplitItem[],
  selectedIds: string[],
  shares: Record<string, number>,
): SplitResult {
  const selected = new Set(selectedIds)
  const subtotal = items
    .filter((item) => selected.has(item.id))
    .reduce((sum, item) => sum + itemShare(item, shares[item.id]), 0)

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

export function receiptSubtotal(items: SplitItem[]): number {
  return items.reduce((sum, item) => sum + item.qty * item.unit_price, 0)
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}
