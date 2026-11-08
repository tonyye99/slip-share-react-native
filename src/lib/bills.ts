import type { Receipt, ReceiptPerson } from '@/lib/types'

import { strings } from '../i18n/strings.ts'
import { realName } from './names.ts'
import { isDiscount, itemShares, peopleInOrder, picksFrom, splitByPicks, splitsFrom } from './split.ts'

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
> &
  Partial<Pick<Receipt, 'split_mode'>> & {
  receipts_items: {
    id: string
    qty: number
    unit_price: number
    receipt_item_people: { person_id: string; units: number; split_between?: number }[]
  }[]
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
  mine?: { share: number; payers: string[]; picked: boolean }
}

const SMALL = 0.005

export function billStatus(bill: Bill): BillStatus {
  const people = peopleInOrder(bill.receipt_people)
  const items = bill.receipts_items
  const itemCount = items.filter((item) => !isDiscount(item)).length
  const picks = picksFrom(items)
  const unassignedItems = items.filter((item) => itemShares(item, Object.keys(picks[item.id]), picks[item.id]).left > 0).length
  const mineMode = bill.split_mode === 'mine'
  const split = splitByPicks(
    bill,
    items,
    people.map((person) => person.id),
    picks,
    mineMode ? splitsFrom(items) : {},
  )
  const owing = (person: Bill['receipt_people'][number]) =>
    !person.is_payer && !person.paid_at && (split.people[person.id]?.total ?? 0) >= SMALL

  const payer = people.find((person) => person.is_payer)
  const me = people.find((person) => person.is_me)
  if (mineMode && me) {
    const share = split.people[me.id]?.total ?? 0
    const payers = people.filter((person) => person.is_payer && !person.is_me).map((person) => person.name)
    const picked = items.some(
      (item) => !isDiscount(item) && item.receipt_item_people.some((row) => row.person_id === me.id),
    )
    const state: BillState =
      me.paid_at && payers.length > 0
        ? 'settled'
        : !picked || payers.length === 0
          ? 'to-split'
          : share >= SMALL
            ? 'waiting'
            : 'settled'
    return {
      state,
      itemCount,
      unassignedItems: 0,
      owedToYou: [],
      youOwe: state === 'waiting' ? share : 0,
      mine: { share, payers, picked },
    }
  }
  if (payer && me && !payer.is_me) {
    return friendPaidStatus(bill, me, payer, { itemCount, unassignedItems }, split.people[me.id]?.total ?? 0)
  }

  const owedToYou: Debt[] = payer?.is_me
    ? people
        .map((person, index) => ({ person, index }))
        .filter(({ person }) => owing(person))
        .map(({ person, index }) => ({ personId: person.id, name: person.name, index, amount: split.people[person.id].total }))
        .sort((a, b) => b.amount - a.amount)
    : []

  const state: BillState =
    unassignedItems > 0 ? 'to-split' : payer && people.some((person) => owing(person)) ? 'waiting' : 'settled'
  return { state, itemCount, unassignedItems, owedToYou, youOwe: 0 }
}

function friendPaidStatus(
  bill: Bill,
  me: Bill['receipt_people'][number],
  payer: Bill['receipt_people'][number],
  { itemCount, unassignedItems }: { itemCount: number; unassignedItems: number },
  myShare: number,
): BillStatus {
  const items = bill.receipts_items
  const pickedBy = (personId: string) =>
    items.some((item) => item.receipt_item_people.some((row) => row.person_id === personId))
  const justMeAndPayer = bill.receipt_people.length === 2 && !pickedBy(payer.id)
  const notSplit = justMeAndPayer ? !pickedBy(me.id) : unassignedItems > 0
  const state: BillState = me.paid_at ? 'settled' : notSplit ? 'to-split' : myShare >= SMALL ? 'waiting' : 'settled'
  return { state, itemCount, unassignedItems, owedToYou: [], youOwe: state === 'waiting' ? myShare : 0 }
}

export function badgeText(status: BillStatus, money: (amount: number) => string) {
  const t = strings().bills
  if (status.state === 'to-split') return status.mine ? (status.mine.picked ? t.pickPayer : t.pickYours) : t.notSplit
  if (status.state === 'settled') return t.settled
  if (status.mine?.payers.length) return t.youOweName(strings().mine.payers(status.mine.payers))
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
  const amountOf = (bill: Bill) => (bill.split_mode === 'mine' ? (billStatus(bill).mine?.share ?? 0) : bill.total)
  return { currency, count: same.length, total: same.reduce((sum, bill) => sum + amountOf(bill), 0) }
}

export function reminderText(debt: Pick<Debt, 'name' | 'amount'>, bill: string, date: string, money: (amount: number) => string) {
  return strings().bills.reminder(debt.name, money(debt.amount), bill, date)
}
