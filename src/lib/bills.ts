import type { Receipt, ReceiptPerson } from '@/lib/types'

import { itemShares, peopleInOrder, picksFrom, splitByPicks } from './split.ts'

// Where each bill on the home screen stands: still to split, waiting on
// people to pay back, or settled. Pure, so it is unit tested.

/** A bill as the home screen loads it: enough to work out who owes what. */
export type Bill = Pick<
  Receipt,
  | 'id'
  | 'merchant_name'
  | 'merchant_name_en'
  | 'currency'
  | 'total'
  | 'subtotal'
  | 'tax_percent'
  | 'service_percent'
  | 'rounding'
  | 'user_type'
  | 'created_at'
> & {
  receipts_items: { id: string; qty: number; unit_price: number; receipt_item_people: { person_id: string; units: number }[] }[]
  receipt_people: Pick<ReceiptPerson, 'id' | 'name' | 'is_me' | 'is_payer' | 'paid_at' | 'created_at'>[]
}

export type BillState = 'to-split' | 'waiting' | 'settled'

/** Someone who still owes the payer, with their place on the bill (for their colour). */
export interface Debt {
  personId: string
  name: string
  index: number
  amount: number
}

export interface BillStatus {
  state: BillState
  itemCount: number
  /** Lines nobody has been given yet, or not all of. */
  unassignedItems: number
  /** People who haven't paid you back yet, biggest first. Empty unless you paid. */
  owedToYou: Debt[]
  /** What you still owe whoever paid, when that wasn't you. */
  youOwe: number
}

const SMALL = 0.005

export function billStatus(bill: Bill): BillStatus {
  const people = peopleInOrder(bill.receipt_people)
  const items = bill.receipts_items
  const picks = picksFrom(items)
  const unassignedItems = items.filter((item) => itemShares(item, Object.keys(picks[item.id]), picks[item.id]).left > 0).length
  const split = splitByPicks(bill, items, people.map((person) => person.id), picks)
  const owing = (person: Bill['receipt_people'][number]) =>
    !person.is_payer && !person.paid_at && (split.people[person.id]?.total ?? 0) >= SMALL

  const payer = people.find((person) => person.is_payer)
  const owedToYou: Debt[] = payer?.is_me
    ? people
        .map((person, index) => ({ person, index }))
        .filter(({ person }) => owing(person))
        .map(({ person, index }) => ({ personId: person.id, name: person.name, index, amount: split.people[person.id].total }))
        .sort((a, b) => b.amount - a.amount)
    : []
  const me = people.find((person) => person.is_me)
  const youOwe = payer && me && owing(me) ? split.people[me.id].total : 0

  const state: BillState =
    unassignedItems > 0 ? 'to-split' : payer && people.some((person) => owing(person)) ? 'waiting' : 'settled'
  return { state, itemCount: items.length, unassignedItems, owedToYou, youOwe }
}

/** What a bill's badge says, like "Not split yet" or "Ben owes ฿715.67". */
export function badgeText(status: BillStatus, money: (amount: number) => string) {
  if (status.state === 'to-split') return 'Not split yet'
  if (status.state === 'settled') return 'Settled'
  const owed = status.owedToYou
  if (owed.length === 1) return `${owed[0].name} owes ${money(owed[0].amount)}`
  if (owed.length > 1) return `${owed.length} people owe ${money(owed.reduce((sum, debt) => sum + debt.amount, 0))}`
  if (status.youOwe >= SMALL) return `You owe ${money(status.youOwe)}`
  return 'Waiting'
}

/** The bill's name: its own name, the English one, or just "Receipt". */
export const billName = (bill: Pick<Bill, 'merchant_name' | 'merchant_name_en'>) =>
  bill.merchant_name || bill.merchant_name_en || 'Receipt'

/** The biggest amount anyone still owes you, and on which bill. */
export function biggestDebt(bills: { bill: Bill; status: BillStatus }[]) {
  let top: { bill: Bill; debt: Debt } | null = null
  for (const { bill, status } of bills) {
    const debt = status.owedToYou[0]
    if (debt && (!top || debt.amount > top.debt.amount)) top = { bill, debt }
  }
  return top
}

/** This month's bills: how many and what they came to, in the currency of the latest one. */
export function monthTotal(bills: Bill[], now: Date) {
  const thisMonth = bills.filter((bill) => {
    const date = new Date(bill.created_at)
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  })
  const currency = thisMonth[0]?.currency ?? bills[0]?.currency ?? 'THB'
  const same = thisMonth.filter((bill) => bill.currency === currency)
  return { currency, count: same.length, total: same.reduce((sum, bill) => sum + bill.total, 0) }
}

/** The message Remind shares, naming the amount and the bill. */
export function reminderText(debt: Pick<Debt, 'name' | 'amount'>, bill: string, date: string, money: (amount: number) => string) {
  return `Hi ${debt.name}! A quick reminder: ${money(debt.amount)} for ${bill} on ${date}. Thank you!`
}
