import { calculateSplit, receiptSubtotal } from '@/lib/split'
import { supabase } from '@/lib/supabase'
import type {
  ParsedReceipt,
  ParticipantShare,
  Receipt,
  ReceiptWithItems,
  ShareCounts,
  UserSelection,
  UserType,
} from '@/lib/types'

// The app talks to Supabase directly; RLS limits each user to receipts they
// own or joined through a share link, and to their own selections (owners can
// also read everyone's selections on their receipts).

export type ReceiptSummary = Pick<
  Receipt,
  'id' | 'user_id' | 'merchant_name' | 'merchant_name_en' | 'currency' | 'total' | 'user_type' | 'created_at'
> & { receipts_items: { count: number }[] }

export async function listReceipts(offset: number, limit: number) {
  const { data, error, count } = await supabase
    .from('receipts')
    .select('id, user_id, merchant_name, merchant_name_en, currency, total, user_type, created_at, receipts_items(count)', {
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
  selectedItemIds: string[],
  shareCounts: ShareCounts,
) {
  const split = calculateSplit(receipt, receipt.receipts_items, selectedItemIds, shareCounts)
  const { data, error } = await supabase
    .from('user_selections')
    .upsert(
      {
        user_id: userId,
        receipt_id: receipt.id,
        selected_items: selectedItemIds,
        item_shares: shareCounts,
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

/** Joins the receipt behind a share link and returns its id. */
export async function joinReceipt(shareToken: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_receipt', { p_share_token: shareToken })
  if (error) throw error
  return data as string
}

async function getDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map()
  const { data, error } = await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds)
  if (error) throw error
  return new Map((data ?? []).map((profile) => [profile.user_id as string, (profile.display_name as string | null) || 'Unnamed']))
}

export async function getOwnerName(ownerId: string): Promise<string> {
  return (await getDisplayNames([ownerId])).get(ownerId) ?? 'Unnamed'
}

/**
 * Everyone on a receipt and what they owe, for the receipt owner. Includes
 * the owner's own selection and people who joined but haven't picked yet.
 */
export async function getParticipantShares(receipt: Receipt, ownerId: string): Promise<ParticipantShare[]> {
  const [participantsRes, selectionsRes] = await Promise.all([
    supabase.from('receipt_participants').select('user_id, joined_at').eq('receipt_id', receipt.id).order('joined_at'),
    supabase.from('user_selections').select('user_id, calculated_total').eq('receipt_id', receipt.id),
  ])
  if (participantsRes.error) throw participantsRes.error
  if (selectionsRes.error) throw selectionsRes.error

  const totals = new Map(selectionsRes.data.map((selection) => [selection.user_id as string, Number(selection.calculated_total)]))
  const userIds = [ownerId, ...participantsRes.data.map((participant) => participant.user_id as string).filter((id) => id !== ownerId)]
  const names = await getDisplayNames(userIds)

  return userIds.map((id) => ({
    user_id: id,
    name: id === ownerId ? 'You' : (names.get(id) ?? 'Unnamed'),
    total: totals.get(id) ?? null,
  }))
}
