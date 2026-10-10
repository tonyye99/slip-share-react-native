import { billTotal, receiptSubtotal } from '@/lib/split'
import { supabase } from '@/lib/supabase'
import type { ParsedReceipt, Receipt, ReceiptPerson, ReceiptWithPeople } from '@/lib/types'

// The app talks to Supabase directly; RLS limits each user to their own
// receipts and the people on them.

export type ReceiptSummary = Pick<
  Receipt,
  'id' | 'merchant_name' | 'merchant_name_en' | 'currency' | 'total' | 'user_type' | 'created_at'
> & { receipts_items: { count: number }[] }

export async function listReceipts(offset: number, limit: number) {
  const { data, error, count } = await supabase
    .from('receipts')
    .select('id, merchant_name, merchant_name_en, currency, total, user_type, created_at, receipts_items(count)', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw error
  return { receipts: (data ?? []) as ReceiptSummary[], total: count ?? 0 }
}

export async function getReceipt(id: string): Promise<ReceiptWithPeople> {
  const { data, error } = await supabase
    .from('receipts')
    .select('*, receipts_items(*, receipt_item_people(person_id)), receipt_people(*)')
    .eq('id', id)
    .single()
  if (error) throw error

  const receipt = data as ReceiptWithPeople
  receipt.receipts_items.sort((a, b) => a.position - b.position)
  // You first, then everyone else in the order they were added.
  receipt.receipt_people.sort((a, b) => Number(b.is_me) - Number(a.is_me) || a.created_at.localeCompare(b.created_at))
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
      merchant_name: parsed.merchant_name || null,
      merchant_name_en: translated ? (parsed.merchant_name_en ?? null) : null,
      original_language: parsed.original_language || null,
      currency: (parsed.currency || 'THB').toUpperCase().slice(0, 3),
      tax_percent: parsed.tax_percent,
      service_percent: parsed.service_percent,
      rounding: parsed.rounding,
      subtotal,
      total,
      raw_json: parsed,
      parser_version: 'gpt-4.1-mini',
      issued_at: new Date().toISOString(),
      // You're the payer until you pick someone else on the receipt screen.
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

/** Adds someone to a receipt by name. */
export async function addPerson(receiptId: string, name: string): Promise<ReceiptPerson> {
  const { data, error } = await supabase.from('receipt_people').insert({ receipt_id: receiptId, name }).select().single()
  if (error) throw error
  return data as ReceiptPerson
}

/** Removes someone from a receipt; the items they had go back to nobody. */
export async function removePerson(personId: string) {
  const { error } = await supabase.from('receipt_people').delete().eq('id', personId)
  if (error) throw error
}

/** Ticks people on items. Rows that are already there are left alone. */
export async function addItemPeople(rows: { item_id: string; person_id: string }[]) {
  if (rows.length === 0) return
  const { error } = await supabase
    .from('receipt_item_people')
    .upsert(rows, { onConflict: 'item_id,person_id', ignoreDuplicates: true })
  if (error) throw error
}

export async function removeItemPeople(itemId: string, personIds: string[]) {
  if (personIds.length === 0) return
  const { error } = await supabase.from('receipt_item_people').delete().eq('item_id', itemId).in('person_id', personIds)
  if (error) throw error
}

/** Makes someone on the receipt the one who paid the bill. */
export async function setPayer(receiptId: string, personId: string) {
  const { error } = await supabase.rpc('set_receipt_payer', { p_receipt_id: receiptId, p_person_id: personId })
  if (error) throw error
}

/** Records (or clears) that someone has paid the payer back. */
export async function setPersonPaid(personId: string, paid: boolean) {
  const { error } = await supabase
    .from('receipt_people')
    .update({ paid_at: paid ? new Date().toISOString() : null })
    .eq('id', personId)
  if (error) throw error
}

/** Names you added to your latest receipts, newest first, for adding them again in one tap. */
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
