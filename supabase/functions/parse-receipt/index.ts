// Supabase Edge Function: parses a receipt photo with OpenAI.
// Ported from slip-share's /api/openai/parse route so the OpenAI key stays
// server-side. Deploy with: supabase functions deploy parse-receipt
// and set the key with: supabase secrets set OPENAI_API_KEY=...
// JWT verification is on by default, so only signed-in users can call it.

import OpenAI from 'npm:openai@5'

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') })

const MAX_BASE64_LENGTH = 14_000_000 // ~10MB image

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function prompt(enableTranslation: boolean): string {
  const base =
    'You are a bill-parsing assistant. First, determine if this image contains a valid receipt or bill. If it does: 1) Detect the original language of the receipt text and provide the ISO 639-1 language code (e.g., "th" for Thai, "en" for English). 2) Identify the currency used in the receipt by looking for currency symbols (฿, $, €, £, ¥, etc.) or text indicators, and provide the 3-letter ISO currency code (e.g., THB, USD, EUR, GBP, JPY). 3) Extract the merchant name, line items, and charges from the receipt in the original language.'
  const notReceipt =
    'If the image is not a receipt (e.g., random photo, document, screenshot), set is_receipt to false and provide empty/default values for other fields.'
  if (enableTranslation) {
    return `${base} 4) Provide English translations for the merchant name and all item names. If the text is already in English, use the same value for both original and English fields. 5) For item names, provide clear, descriptive English translations that would help users understand what they ordered. ${notReceipt}`
  }
  return `${base} ${notReceipt}`
}

function schema(enableTranslation: boolean) {
  const itemProperties: Record<string, unknown> = {
    id: { type: 'string' },
    name: { type: 'string', description: 'Item name in original language' },
    qty: { type: 'integer' },
    unit_price: { type: 'number' },
  }
  const itemRequired = ['id', 'name', 'qty', 'unit_price']
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
      description: 'The name of the restaurant, business, or merchant from the receipt in original language',
    },
    items: {
      type: 'array',
      items: { type: 'object', properties: itemProperties, required: itemRequired, additionalProperties: false },
    },
    tax_percent: { type: 'number' },
    service_percent: { type: 'number' },
    total: { type: 'number' },
    subtotal: { type: 'number' },
    rounding: { type: 'number' },
  }
  const required = [
    'is_receipt',
    'original_language',
    'currency',
    'merchant_name',
    'items',
    'tax_percent',
    'service_percent',
    'total',
    'subtotal',
    'rounding',
  ]
  if (enableTranslation) {
    properties.merchant_name_en = {
      type: 'string',
      description: 'English translation of the merchant name. If already in English, use the same value as merchant_name',
    }
    required.push('merchant_name_en')
    itemProperties.name_en = {
      type: 'string',
      description: 'English translation of item name. If already in English, use the same value as name',
    }
    itemRequired.push('name_en')
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

  try {
    const result = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt(enableTranslation) },
            { type: 'input_image', detail: 'auto', image_url: `data:image/jpeg;base64,${imageBase64}` },
          ],
        },
      ],
      text: {
        format: { type: 'json_schema', name: 'parse_bill', schema: schema(enableTranslation), strict: true },
      },
    })
    return json(JSON.parse(result.output_text))
  } catch (error) {
    console.error('parse-receipt failed:', error)
    return json({ error: 'Failed to parse receipt' }, 500)
  }
})
