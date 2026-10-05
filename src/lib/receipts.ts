import { calculateSplit, receiptSubtotal } from '@/lib/split'
import { supabase } from '@/lib/supabase'
import type {
  ParsedReceipt,
  Receipt,
  ReceiptWithItems,
  ShareCounts,
  UserSelection,
  UserType,
} from '@/lib/types'

// The app talks to Supabase directly; the tables' RLS policies limit each
// user to their own receipts and selections, same as the web app's API routes.

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

export async function getReceipt(id: string, userId: string) {
  const [receiptRes, selectionRes] = await Promise.all([
    supabase.from('receipts').select('*, receipts_items(*)').eq('id', id).single(),
    supabase.from('user_selections').select('*').eq('receipt_id', id).eq('user_id', userId).maybeSingle(),
  ])
  if (receiptRes.error) throw receiptRes.error
  if (selectionRes.error) throw selectionRes.error

  const receipt = receiptRes.data as ReceiptWithItems
  receipt.receipts_items.sort((a, b) => a.position - b.position)
  return { receipt, selection: selectionRes.data as UserSelection | null }
}

export async function createReceipt(parsed: ParsedReceipt, userType: UserType, userId: string) {
  const translated = parsed.original_language !== 'en'
  const subtotal = receiptSubtotal(parsed.items)
  const total =
    parsed.total ||
    subtotal + (subtotal * parsed.tax_percent) / 100 + (subtotal * parsed.service_percent) / 100 + parsed.rounding

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
      user_type: userType,
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

export async function saveSelection(
  receipt: ReceiptWithItems,
  userId: string,
  selectedItems: string[],
  itemShares: ShareCounts,
) {
  const split = calculateSplit(receipt, receipt.receipts_items, selectedItems, itemShares)
  const { data, error } = await supabase
    .from('user_selections')
    .upsert(
      {
        user_id: userId,
        receipt_id: receipt.id,
        selected_items: selectedItems,
        item_shares: itemShares,
        calculated_total: split.total,
        tax_amount: split.tax,
        service_amount: split.service,
        rounding_amount: split.rounding,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,receipt_id' },
    )
    .select()
    .single()
  if (error) throw error
  return data as UserSelection
}
