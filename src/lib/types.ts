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
  user_type: UserType
  share_token: string
  link_enabled: boolean
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

export interface ReceiptPerson {
  id: string
  receipt_id: string
  name: string
  is_me: boolean
  is_payer: boolean
  paid_at: string | null
  guest_key: string | null
  slip_path?: string | null
  slip_at?: string | null
  created_at: string
}

export interface ReceiptWithPeople extends Receipt {
  receipts_items: (ReceiptItem & { receipt_item_people: { person_id: string; units: number }[] })[]
  receipt_people: ReceiptPerson[]
}

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
  tax_on_items_only?: boolean
}
