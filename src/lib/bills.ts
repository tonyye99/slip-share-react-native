import type { Receipt, ReceiptPerson } from '@/lib/types'

import { strings } from '../i18n/strings.ts'
import { realName } from './names.ts'
import { itemShares, peopleInOrder, picksFrom, splitByPicks } from './split.ts'

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

export interface Debt {
  personId: string
  name: string
  index: number
  amount: number
}

export interface BillStatus {
  state: BillState
  itemCount: number
  unassignedItems: number
  owedToYou: Debt[]
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

export function badgeText(status: BillStatus, money: (amount: number) => string) {
  const t = strings().bills
  if (status.state === 'to-split') return t.notSplit
  if (status.state === 'settled') return t.settled
  const owed = status.owedToYou
  if (owed.length === 1) return t.owes(owed[0].name, money(owed[0].amount))
  if (owed.length > 1) return t.peopleOwe(owed.length, money(owed.reduce((sum, debt) => sum + debt.amount, 0)))
  if (status.youOwe >= SMALL) return t.youOwe(money(status.youOwe))
  return t.waiting
}

export const billName = (bill: Pick<Bill, 'merchant_name' | 'merchant_name_en'>) =>
  realName(bill.merchant_name) || realName(bill.merchant_name_en) || strings().common.receipt

export function biggestDebt(bills: { bill: Bill; status: BillStatus }[]) {
  let top: { bill: Bill; debt: Debt } | null = null
  for (const { bill, status } of bills) {
    const debt = status.owedToYou[0]
    if (debt && (!top || debt.amount > top.debt.amount)) top = { bill, debt }
  }
  return top
}

export function monthTotal(bills: Bill[], now: Date) {
  const thisMonth = bills.filter((bill) => {
    const date = new Date(bill.created_at)
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  })
  const currency = thisMonth[0]?.currency ?? bills[0]?.currency ?? 'THB'
  const same = thisMonth.filter((bill) => bill.currency === currency)
  return { currency, count: same.length, total: same.reduce((sum, bill) => sum + bill.total, 0) }
}

export function reminderText(debt: Pick<Debt, 'name' | 'amount'>, bill: string, date: string, money: (amount: number) => string) {
  return strings().bills.reminder(debt.name, money(debt.amount), bill, date)
}
