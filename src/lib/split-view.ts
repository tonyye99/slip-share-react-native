// Small helpers the split screen and its parts share: names, labels and
// what an item's row says about who had it.

import { Platform } from 'react-native'

import { strings } from '@/i18n/strings'
import { isCountable } from '@/lib/split'
import type { ReceiptPerson, ReceiptWithPeople } from '@/lib/types'

export type Item = ReceiptWithPeople['receipts_items'][number]
export type Money = (amount: number) => string

/** A person as the split screen's parts draw them. */
export interface PersonView {
  id: string
  name: string
  color: string
}

const FRACTIONS: Record<number, string> = { 2: '½', 3: '⅓', 4: '¼', 5: '⅕', 6: '⅙', 8: '⅛' }

/** Your own line reads "You" on screen. */
export const nameOf = (person: ReceiptPerson) => (person.is_me ? strings().common.you : person.name)

/** How much of a line someone had, like "⅓" or "1 of 2". Empty when it was all theirs. */
export function partOf(item: Item, share: number) {
  const lineTotal = item.qty * item.unit_price
  if (lineTotal <= 0 || share / lineTotal > 0.999) return ''
  const part = share / lineTotal
  const units = part * item.qty
  if (isCountable(item) && Math.abs(units - Math.round(units)) < 0.001) return strings().common.unitsOf(Math.round(units), item.qty)
  const parts = Math.round(1 / part)
  if (Math.abs(1 / parts - part) < 0.001) return FRACTIONS[parts] ?? `1/${parts}`
  return `${Math.round(part * 100)}%`
}

export interface ItemStatus {
  text: string
  /** Something on this line still needs someone. */
  warn: boolean
  /** Shared by several people in even parts, so `text` is what each pays. */
  even?: boolean
}

/** What an item's row says about who had it. */
export function itemStatus(
  item: Item,
  had: string[],
  { shares, left }: { shares: Record<string, number>; left: number },
  people: ReceiptPerson[],
  money: Money,
): ItemStatus {
  const t = strings()
  if (had.length === 0) return { text: t.split.tapWhoHadIt, warn: true }
  if (left > 0) return { text: t.split.notAssigned(left, item.qty), warn: true }
  if (had.length > 1) {
    const first = shares[had[0]]
    const even = had.every((personId) => Math.abs(shares[personId] - first) < 0.005)
    return { text: even ? t.common.each(money(first)) : t.split.shared, warn: false, even }
  }
  const only = people.find((person) => person.id === had[0])
  return { text: !only || only.is_me ? t.split.allYours : t.split.allTheirs(only.name), warn: false }
}

/** iOS can't show the share sheet or another sheet until the last one has slid away. */
export const afterSheet = (run: () => void) => setTimeout(run, Platform.OS === 'ios' ? 400 : 0)
