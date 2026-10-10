// Mirrors the Supabase schema in supabase/migrations.

export type UserType = 'payer' | 'sharer'

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
  /** 'payer' when you paid. Follows receipt_people.is_payer; the web app reads it. */
  user_type: UserType
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

/** Someone at the table, added by name by the receipt owner. */
export interface ReceiptPerson {
  id: string
  receipt_id: string
  name: string
  /** The owner's own line, shown as "You". */
  is_me: boolean
  /** Paid the bill. At most one per receipt. */
  is_payer: boolean
  /** When they paid the payer back. */
  paid_at: string | null
  created_at: string
}

/** A receipt with its items, who had each item, and everyone on it. */
export interface ReceiptWithPeople extends Receipt {
  receipts_items: (ReceiptItem & { receipt_item_people: { person_id: string }[] })[]
  receipt_people: ReceiptPerson[]
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
