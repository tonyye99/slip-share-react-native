// Mirrors the Supabase schema in supabase/migrations.

export type UserType = 'payer' | 'sharer'

/** item_id -> number of people sharing that item (1–99). */
export type ShareCounts = Record<string, number>

export interface Receipt {
  id: string
  user_id: string
  merchant_name: string | null
  merchant_name_en: string | null
  original_language: string | null
  currency: string
  tax_percent: number
  service_percent: number
  rounding: number
  subtotal: number
  total: number
  user_type: UserType
  /** Token in the share link; see join_receipt() in supabase/migrations. */
  share_token: string
  created_at: string
  updated_at: string
}

export interface ReceiptItem {
  id: string
  receipt_id: string
  position: number
  name: string
  name_en: string | null
  qty: number
  unit_price: number
}

export interface ReceiptWithItems extends Receipt {
  receipts_items: ReceiptItem[]
}

export interface UserSelection {
  id: string
  user_id: string
  receipt_id: string
  selected_items: string[]
  item_shares: ShareCounts
  calculated_total: number
  tax_amount: number
  service_amount: number
  rounding_amount: number
  updated_at: string
}

/** Output of the parse-receipt Edge Function (same shape as the web app's OpenAI schema). */
export interface ParsedItem {
  id: string
  name: string
  name_en?: string
  qty: number
  unit_price: number
}

export interface ParsedReceipt {
  is_receipt: boolean
  original_language: string
  currency: string
  merchant_name: string
  merchant_name_en?: string
  items: ParsedItem[]
  tax_percent: number
  service_percent: number
  subtotal: number
  total: number
  rounding: number
}

/** One person's line in the owner's "who owes what" list. */
export interface ParticipantShare {
  user_id: string
  name: string
  /** null until they have picked their items. */
  total: number | null
}
