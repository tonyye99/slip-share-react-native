import type { ParsedItem } from '@/lib/types'

import { strings } from '../i18n/strings.ts'

// Editing parsed items on the review screen. Inputs keep the text as typed so
// a half-typed number like "12." isn't rewritten while you type; it is parsed
// and rounded to what the database stores (qty 3 decimals, price 2) on save.

export interface ItemInput {
  key: string
  name: string
  /** Dropped when you rename the item, since the translation no longer matches. */
  name_en?: string
  qty: string
  unit_price: string
}

export interface ItemErrors {
  name?: string
  qty?: string
  unit_price?: string
}

let nextKey = 0

export function toItemInputs(items: ParsedItem[]): ItemInput[] {
  return items.map((item) => ({
    key: `parsed-${nextKey++}`,
    name: item.name,
    name_en: item.name_en,
    qty: String(item.qty),
    unit_price: String(item.unit_price),
  }))
}

export function newItemInput(): ItemInput {
  return { key: `added-${nextKey++}`, name: '', qty: '1', unit_price: '' }
}

/** Parses a typed number, accepting a comma as the decimal point. */
export function parseNumber(text: string): number | null {
  const normalized = text.trim().replace(',', '.')
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(normalized)) return null
  return Number(normalized)
}

export function itemErrors(input: ItemInput): ItemErrors {
  const errors: ItemErrors = {}
  const qty = parseNumber(input.qty)
  const t = strings().review
  if (!input.name.trim()) errors.name = t.enterName
  if (qty === null || qty <= 0) errors.qty = t.enterQty
  if (parseNumber(input.unit_price) === null) errors.unit_price = t.enterPrice
  return errors
}

export const hasErrors = (errors: ItemErrors) => Object.keys(errors).length > 0

/** Qty and price as numbers for live totals; anything not yet valid counts as 0. */
export function amountsOf(input: ItemInput) {
  return { qty: parseNumber(input.qty) ?? 0, unit_price: parseNumber(input.unit_price) ?? 0 }
}

/** The edited items in the parser's shape, or null if any is invalid or there are none. */
export function toParsedItems(inputs: ItemInput[]): ParsedItem[] | null {
  if (inputs.length === 0 || inputs.some((input) => hasErrors(itemErrors(input)))) return null
  return inputs.map((input) => {
    const { qty, unit_price } = amountsOf(input)
    return {
      id: input.key,
      name: input.name.trim(),
      name_en: input.name_en,
      qty: Math.round(qty * 1000) / 1000,
      unit_price: Math.round(unit_price * 100) / 100,
    }
  })
}

/** The service charge or tax on the review screen: added or not, and its percent as typed. */
export interface ChargeInput {
  on: boolean
  percent: string
}

export const toChargeInput = (percent: number): ChargeInput => ({
  on: percent > 0,
  percent: percent > 0 ? String(percent) : '',
})

/** The percent to charge: 0 when it's off, or null while it's on without a number from 0 to 100. */
export function chargePercent(input: ChargeInput): number | null {
  if (!input.on) return 0
  const percent = parseNumber(input.percent)
  if (percent === null || percent < 0 || percent > 100) return null
  return Math.round(percent * 10000) / 10000
}
