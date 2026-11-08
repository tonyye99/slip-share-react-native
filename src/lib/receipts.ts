import { strings } from '@/i18n/strings'
import { confirmDestructive } from '@/lib/alert'
import type { Bill } from '@/lib/bills'
import { realName } from '@/lib/names'
import { removeSlipFiles } from '@/lib/slips'
import { billTotal, peopleInOrder, receiptSubtotal, readSavedCharges } from '@/lib/split'
import { supabase } from '@/lib/supabase'
import type { ParsedReceipt, ReceiptPerson, ReceiptWithPeople, SplitMode } from '@/lib/types'

export async function listBills(offset: number, limit: number) {
  const { data, error, count } = await supabase
    .from('receipts')
    .select(
      'id, merchant_name, merchant_name_en, currency, total, subtotal, tax_percent, service_percent, rounding, user_type, ' +
        'split_mode, created_at, ' +
        'receipts_items(id, qty, unit_price, receipt_item_people(person_id, units, split_between)), ' +
        'receipt_people(id, name, is_me, is_payer, paid_at, created_at)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw error
  return { bills: ((data ?? []) as unknown as Bill[]).map(readSavedCharges), total: count ?? 0 }
}

export async function getReceipt(id: string): Promise<ReceiptWithPeople> {
  const { data, error } = await supabase
    .from('receipts')
    .select('*, receipts_items(*, receipt_item_people(person_id, units, split_between)), receipt_people(*)')
    .eq('id', id)
    .single()
  if (error) throw error

  const receipt = readSavedCharges(data as ReceiptWithPeople)
  receipt.receipts_items.sort((a, b) => a.position - b.position)
  receipt.receipt_people = peopleInOrder(receipt.receipt_people)
  return receipt
}

export async function createReceipt(parsed: ParsedReceipt, userId: string) {
  const translated = parsed.original_language !== 'en'
  const subtotal = receiptSubtotal(parsed.items)
  const total = parsed.total || billTotal(parsed, subtotal)

  const { data: receipt, error } = await supabase
    .from('receipts')
    .insert({
      user_id: userId,
      merchant_name: realName(parsed.merchant_name),
      merchant_name_en: translated ? realName(parsed.merchant_name_en) : null,
      original_language: parsed.original_language || null,
      currency: (parsed.currency || 'THB').toUpperCase().slice(0, 3),
      tax_percent: parsed.tax_percent,
      service_percent: parsed.service_percent,
      rounding: parsed.rounding,
      subtotal,
      total,
      raw_json: parsed,
      parser_version: parsed.reader ?? 'gpt-4.1-mini',
      issued_at: new Date().toISOString(),
      user_type: 'payer',
    })
    .select('id')
    .single()
  if (error) throw error

  const { error: itemsError } = await supabase.from('receipts_items').insert(
    parsed.items.map((item, i) => ({
      receipt_id: receipt.id,
      position: i + 1,
      name: item.name,
      name_en: translated ? (item.name_en ?? null) : null,
      qty: item.qty,
      unit_price: item.unit_price,
    })),
  )
  if (itemsError) {
    await supabase.from('receipts').delete().eq('id', receipt.id)
    throw itemsError
  }
  return receipt.id as string
}

export async function addPerson(receiptId: string, name: string): Promise<ReceiptPerson> {
  const { data, error } = await supabase.from('receipt_people').insert({ receipt_id: receiptId, name }).select().single()
  if (error) throw error
  return data as ReceiptPerson
}

export async function renameReceipt(receiptId: string, name: string) {
  const { error } = await supabase.from('receipts').update({ merchant_name: name, merchant_name_en: null }).eq('id', receiptId)
  if (error) throw error
}

export async function setPaidTheBill(personId: string, paidTheBill: boolean) {
  const { error } = await supabase
    .from('receipt_people')
    .update(paidTheBill ? { is_payer: true, paid_at: null } : { is_payer: false })
    .eq('id', personId)
  if (error) throw error
}

export async function removePerson(receiptId: string, personId: string) {
  await removeSlipFiles(receiptId, personId)
  const { error } = await supabase.from('receipt_people').delete().eq('id', personId)
  if (error) throw error
}

export async function addItemPeople(
  rows: { item_id: string; person_id: string; units: number; split_between?: number }[],
) {
  if (rows.length === 0) return
  const { error } = await supabase.from('receipt_item_people').upsert(rows, { onConflict: 'item_id,person_id' })
  if (error) throw error
}

export async function removeItemPeople(itemId: string, personIds: string[]) {
  if (personIds.length === 0) return
  const { error } = await supabase.from('receipt_item_people').delete().eq('item_id', itemId).in('person_id', personIds)
  if (error) throw error
}

export async function setSplitMode(receiptId: string, mode: SplitMode) {
  const { error } = await supabase.from('receipts').update({ split_mode: mode }).eq('id', receiptId)
  if (error) throw error
}

export async function resetItemSplits(itemIds: string[], personId: string) {
  if (itemIds.length === 0) return
  const { error } = await supabase
    .from('receipt_item_people')
    .update({ split_between: 1 })
    .eq('person_id', personId)
    .in('item_id', itemIds)
  if (error) throw error
}

export async function setPayer(receiptId: string, personId: string) {
  const { error } = await supabase.rpc('set_receipt_payer', { p_receipt_id: receiptId, p_person_id: personId })
  if (error) throw error
}

export async function setPersonPaid(personId: string, paid: boolean) {
  const { error } = await supabase
    .from('receipt_people')
    .update({ paid_at: paid ? new Date().toISOString() : null })
    .eq('id', personId)
  if (error) throw error
}

export async function getRecentNames(): Promise<string[]> {
  const { data, error } = await supabase
    .from('receipts')
    .select('receipt_people(name, is_me)')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error

  const seen = new Set<string>()
  const names: string[] = []
  for (const receipt of data as { receipt_people: Pick<ReceiptPerson, 'name' | 'is_me'>[] }[]) {
    for (const person of receipt.receipt_people) {
      const key = person.name.toLowerCase()
      if (person.is_me || seen.has(key)) continue
      seen.add(key)
      names.push(person.name)
    }
  }
  return names
}

export function confirmDeleteReceipt(onConfirm: () => void) {
  const t = strings()
  confirmDestructive(t.bills.deleteTitle, t.bills.deleteMessage, t.common.delete, onConfirm)
}

export async function deleteReceipt(receiptId: string): Promise<void> {
  await removeSlipFiles(receiptId)
  const { data, error } = await supabase.from('receipts').delete().eq('id', receiptId).select('id')
  if (error) throw error
  if (!data.length) throw new Error('Receipt not found')
}

export async function setReceiptLink(receiptId: string, enabled: boolean): Promise<string> {
  const { data, error } = await supabase.rpc('set_receipt_link', { p_receipt_id: receiptId, p_enabled: enabled })
  if (error) throw error
  return data as string
}
