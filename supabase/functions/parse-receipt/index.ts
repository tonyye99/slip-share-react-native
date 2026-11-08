import { createClient } from 'npm:@supabase/supabase-js@2'
import OpenAI from 'npm:openai@5'

import {
  better,
  describe,
  fromLines,
  readsRight,
  recheckNote,
  trustedColumn,
  withServiceAmount,
  type Reading,
  type ScanItem,
} from './check.ts'

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') })
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const MAX_BASE64_LENGTH = 14_000_000

interface Reader {
  model: string
  effort?: 'low' | 'medium'
}

const FIRST: Reader = { model: 'gpt-6-luna', effort: 'low' }
const RECHECK: Reader = { model: 'gpt-6.1-terra', effort: 'medium' }
const FIRST_FALLBACK: Reader = { model: 'gpt-4.1-mini' }
const RECHECK_FALLBACK: Reader = { model: 'gpt-4.1' }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function prompt(enableTranslation: boolean): string {
  const base =
    'You are a bill-parsing assistant. First, determine if this image contains a valid receipt or bill. If it does: 1) Detect the original language of the receipt text and provide the ISO 639-1 language code (e.g., "th" for Thai, "en" for English). 2) Identify the currency used in the receipt by looking for currency symbols (฿, $, €, £, ¥, etc.) or text indicators, and provide the 3-letter ISO currency code (e.g., THB, USD, EUR, GBP, JPY). 3) Extract the merchant name, line items, and charges from the receipt in the original language. Read the items line by line. First list every amount in the price column above the totals, top to bottom, in price_column. Every one of those amounts belongs to exactly one item or one discount. Then, reading only the text to the left of the amounts, list every line of item text top to bottom in name_lines, including the second lines of names that wrap. Mark starts_item true for a line that begins a new item or discount, and false for a line that continues the item above it (usually indented). There must be exactly one starts_item line per amount. Then give one item per amount, in the same order: its name is its name lines joined, and its line_total is the amount in the same position. An item name can run over two or more lines, often with the next line indented (for example "Welcome Pack" then "TahitiLemonJuice", or "Iced Latte" then "SIAM_BLEND"): join those lines into one item name. Never merge two items that each have their own amount, and never leave an amount out. A number inside an item name (like the 59 in "Add on Drink 59 THB") is part of the name, not an amount. On a photo taken at an angle, an amount can sit a line or more above or below its name, so do not pair a name with the amount straight across from it: match them in order, the first item with the first amount, the second item with the second amount, and so on. Check your work: the line_totals, including negative discounts, should add up to the printed subtotal, or to the total minus service charge, tax and rounding. If they do not, read the items again. Only report tax_percent and service_percent for charges added on top of the item prices. If the receipt says tax/VAT or the service charge is already included in the prices (for example "VAT Included", "7% VAT INCLUDED", "incl. VAT", or a "Before VAT" breakdown), or the total equals the sum of the items, set that percent to 0. Look at the whole receipt for this, including the lines printed under the total. Report the service charge amount exactly as printed in service_amount. 4) Promotions and discounts: when a discount or promotion is for one item (printed under it or naming it, like "Buy 1 get 1" or "-20%"), take it off that item\'s line_total and do not list it on its own. When it is for the whole bill (member discount, coupon, % off the bill), list it as its own item with qty 1 and a negative line_total.'
  const notReceipt =
    'If the image is not a receipt (e.g., random photo, document, screenshot), set is_receipt to false and provide empty/default values for other fields.'
  if (enableTranslation) {
    return `${base} 5) Provide English translations for the merchant name and all item names. If the text is already in English, use the same value for both original and English fields. 6) For item names, provide clear, descriptive English translations that would help users understand what they ordered. ${notReceipt}`
  }
  return `${base} ${notReceipt}`
}

function schema(enableTranslation: boolean) {
  const itemProperties: Record<string, unknown> = {
    id: { type: 'string' },
    name: { type: 'string', description: 'Item name in original language' },
    qty: { type: 'integer' },
    line_total: {
      type: 'number',
      description: 'The amount for this whole line, for all of its quantity, after any discount for this item. Negative for a whole-bill discount.',
    },
  }
  const itemRequired = ['id', 'name', 'qty', 'line_total']
  const lineProperties: Record<string, unknown> = {
    text: { type: 'string', description: 'The line as printed, in the original language' },
    starts_item: {
      type: 'boolean',
      description: 'True when this line begins a new item or discount. False when it continues the name of the item above it.',
    },
  }
  const lineRequired = ['text', 'starts_item']
  const properties: Record<string, unknown> = {
    is_receipt: {
      type: 'boolean',
      description: 'Whether the image contains a valid receipt or bill.',
    },
    original_language: {
      type: 'string',
      description: 'The detected language of the receipt text (ISO 639-1 code, e.g., "th", "en", "ja", "ko")',
    },
    currency: {
      type: 'string',
      description: 'The currency used in the receipt (3-letter ISO code, e.g., "THB", "USD", "EUR", "GBP", "JPY").',
    },
    merchant_name: {
      type: 'string',
      description: 'The name of the restaurant, business, or merchant from the receipt in original language. If no name is printed, use an empty string, never "Unknown".',
    },
    price_column: {
      type: 'array',
      items: { type: 'number' },
      description:
        'Every amount printed in the price column above the subtotal, service and total lines, top to bottom, including negative discounts. One entry per amount.',
    },
    name_lines: {
      type: 'array',
      items: { type: 'object', properties: lineProperties, required: lineRequired, additionalProperties: false },
      description:
        'Every line of item text left of the price column, above the subtotal, service and total lines, top to bottom, without quantities or amounts.',
    },
    items: {
      type: 'array',
      items: { type: 'object', properties: itemProperties, required: itemRequired, additionalProperties: false },
    },
    tax_percent: { type: 'number' },
    service_percent: { type: 'number' },
    service_amount: {
      type: 'number',
      description: 'The service charge amount printed on the receipt, like 99.00 on a "Service Charge 10%" line. 0 if none is printed.',
    },
    total: { type: 'number' },
    subtotal: { type: 'number' },
    rounding: { type: 'number' },
  }
  const required = [
    'is_receipt',
    'original_language',
    'currency',
    'merchant_name',
    'price_column',
    'name_lines',
    'items',
    'tax_percent',
    'service_percent',
    'service_amount',
    'total',
    'subtotal',
    'rounding',
  ]
  if (enableTranslation) {
    properties.merchant_name_en = {
      type: 'string',
      description: 'English translation of the merchant name. If already in English, use the same value as merchant_name. Empty string if merchant_name is empty.',
    }
    required.push('merchant_name_en')
    itemProperties.name_en = {
      type: 'string',
      description: 'English translation of item name. If already in English, use the same value as name',
    }
    itemRequired.push('name_en')
    lineProperties.text_en = {
      type: 'string',
      description: 'English translation of this line. If already in English, use the same value as text',
    }
    lineRequired.push('text_en')
  }
  return { type: 'object', properties, required, additionalProperties: false }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace(/^Bearer /i, '')
  const { data: auth } = token ? await supabase.auth.getUser(token) : { data: { user: null } }
  if (!auth.user) return json({ error: 'Sign in to scan receipts' }, 401)

  let imageBase64: unknown
  let enableTranslation = false
  try {
    const body = await req.json()
    imageBase64 = body.imageBase64
    enableTranslation = body.enableTranslation === true
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
    return json({ error: 'imageBase64 is required' }, 400)
  }
  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return json({ error: 'Image is too large' }, 413)
  }

  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: consent, error: consentError } = await userClient.from('ai_consents').select('user_id').maybeSingle()
  if (consentError) {
    console.error('ai_consents lookup failed:', consentError)
    return json({ error: 'Failed to parse receipt' }, 500)
  }
  if (!consent) return json({ error: 'consent_required' }, 403)

  const scanDay = new Date().toISOString().slice(0, 10)
  const { data: claim, error: limitError } = await userClient.rpc('claim_receipt_scan')
  if (limitError) {
    console.error('claim_receipt_scan failed:', limitError)
    return json({ error: 'Failed to parse receipt' }, 500)
  }
  if (claim !== 'ok') return json({ error: 'scan_limit', limit: claim }, 429)

  const read = async ({ model, effort }: Reader, note: string) => {
    const result = await openai.responses.create({
      model,
      ...(effort ? { reasoning: { effort } } : {}),
      store: false,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: note ? `${prompt(enableTranslation)} ${note}` : prompt(enableTranslation) },
            { type: 'input_image', detail: 'high', image_url: `data:image/jpeg;base64,${imageBase64}` },
          ],
        },
      ],
      text: {
        format: { type: 'json_schema', name: 'parse_bill', schema: schema(enableTranslation), strict: true },
      },
    })
    return JSON.parse(result.output_text) as Omit<Reading, 'items'> & { items: ScanItem[] }
  }

  const readWith = async (reader: Reader, fallback: Reader, note: string) => {
    try {
      return { model: reader.model, reading: await read(reader, note) }
    } catch (error) {
      console.error(`parse-receipt ${reader.model} failed, reading with ${fallback.model}:`, error)
      return { model: fallback.model, reading: await read(fallback, note) }
    }
  }

  try {
    const firstRead = await readWith(FIRST, FIRST_FALLBACK, '')
    const column = trustedColumn(firstRead.reading)
    const first = fromLines(firstRead.reading, column)
    let parsed = first
    let reader = firstRead.model
    if (!readsRight(first)) {
      try {
        const secondRead = await readWith(RECHECK, RECHECK_FALLBACK, recheckNote(firstRead.reading, column))
        const second = fromLines(secondRead.reading, column ?? trustedColumn(secondRead.reading))
        parsed = better(first, second)
        if (parsed === second) reader = secondRead.model
        console.log(
          `parse-receipt recheck: ${firstRead.model} read ${describe(first)}; ${secondRead.model} read ${describe(second)}; kept ${reader}`,
        )
      } catch (error) {
        console.error('parse-receipt recheck failed:', error)
      }
    }
    parsed = withServiceAmount(parsed)
    const items = parsed.items.map(({ line_total, ...item }) => {
      const qty = Math.max(1, item.qty)
      return { ...item, qty, unit_price: Math.round((line_total / qty) * 100) / 100 }
    })
    return json({ ...parsed, items, reader })
  } catch (error) {
    console.error('parse-receipt failed:', error)
    const { error: refundError } = await admin.rpc('refund_receipt_scan', { p_user: auth.user.id, p_day: scanDay })
    if (refundError) console.error('refund_receipt_scan failed:', refundError)
    return json({ error: 'Failed to parse receipt' }, 500)
  }
})
