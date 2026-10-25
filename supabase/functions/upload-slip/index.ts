// Supabase Edge Function: a friend on the friend link adds (or removes) a
// screenshot of the transfer they made to pay the payer back.
// Deploy with: supabase functions deploy upload-slip
// Friends aren't signed in, so instead of a user this checks the link token
// and the guest key the friend got when they picked their name (the same
// check set_link_pick makes). The photo goes in the private "slips" bucket,
// which only the bill's owner can read (supabase/migrations/*_payment_slips.sql).

import { createClient } from 'npm:@supabase/supabase-js@2'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const BUCKET = 'slips'
// The app shrinks slips to well under this before sending them.
const MAX_BYTES = 2 * 1024 * 1024
const MAX_BASE64_LENGTH = Math.ceil(MAX_BYTES / 3) * 4

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface Body {
  token?: unknown
  person_id?: unknown
  guest_key?: unknown
  /** A JPEG as base64, or null to remove the slip. */
  image_base64?: unknown
}

function decodeJpeg(base64: string): Uint8Array | null {
  let bytes: Uint8Array
  try {
    bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  } catch {
    return null
  }
  // Every JPEG starts FF D8 FF.
  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  return isJpeg && bytes.length <= MAX_BYTES ? bytes : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  const { token, person_id, guest_key, image_base64 } = body
  const ids = [token, person_id, guest_key]
  if (!ids.every((id) => typeof id === 'string' && UUID.test(id))) return json({ error: 'Bad request' }, 400)
  if (image_base64 !== null && typeof image_base64 !== 'string') return json({ error: 'Bad request' }, 400)
  if (typeof image_base64 === 'string' && image_base64.length > MAX_BASE64_LENGTH) {
    return json({ error: 'That image is too big' }, 413)
  }

  // The link has to be on, and the friend has to be the one who picked this name.
  const { data: receipt, error: receiptError } = await admin
    .from('receipts')
    .select('id')
    .eq('share_token', token)
    .eq('link_enabled', true)
    .maybeSingle()
  if (receiptError) {
    console.error('Receipt lookup failed:', receiptError)
    return json({ error: 'Could not save the slip' }, 500)
  }
  if (!receipt) return json({ error: 'This link no longer works' }, 404)

  const { data: person, error: personError } = await admin
    .from('receipt_people')
    .select('id, slip_path')
    .eq('id', person_id)
    .eq('receipt_id', receipt.id)
    .eq('guest_key', guest_key)
    .maybeSingle()
  if (personError) {
    console.error('Person lookup failed:', personError)
    return json({ error: 'Could not save the slip' }, 500)
  }
  if (!person) return json({ error: 'Pick your name again' }, 403)

  const oldPath: string | null = person.slip_path

  if (image_base64 === null) {
    if (oldPath) {
      const { error } = await admin.storage.from(BUCKET).remove([oldPath])
      if (error) {
        console.error('Slip remove failed:', error)
        return json({ error: 'Could not remove the slip' }, 500)
      }
    }
    const { error } = await admin
      .from('receipt_people')
      .update({ slip_path: null, slip_at: null })
      .eq('id', person.id)
    if (error) {
      console.error('Slip clear failed:', error)
      return json({ error: 'Could not remove the slip' }, 500)
    }
    return json({ slip_sent: false })
  }

  const bytes = decodeJpeg(image_base64)
  if (!bytes) return json({ error: 'Send the slip as a photo' }, 400)

  // A new name for each slip, so the owner never sees an old copy from a cache.
  const path = `${receipt.id}/${person.id}-${Date.now()}.jpg`
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: false })
  if (uploadError) {
    console.error('Slip upload failed:', uploadError)
    return json({ error: 'Could not save the slip' }, 500)
  }

  // Checked again in case the owner removed this person in the meantime.
  const { data: saved, error: updateError } = await admin
    .from('receipt_people')
    .update({ slip_path: path, slip_at: new Date().toISOString() })
    .eq('id', person.id)
    .eq('guest_key', guest_key)
    .select('id')
  if (updateError || !saved?.length) {
    if (updateError) console.error('Slip save failed:', updateError)
    await admin.storage.from(BUCKET).remove([path])
    return updateError ? json({ error: 'Could not save the slip' }, 500) : json({ error: 'Pick your name again' }, 403)
  }

  if (oldPath && oldPath !== path) {
    const { error } = await admin.storage.from(BUCKET).remove([oldPath])
    if (error) console.error('Old slip remove failed:', error)
  }
  return json({ slip_sent: true })
})
