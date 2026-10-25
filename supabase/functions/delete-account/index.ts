// Supabase Edge Function: deletes the signed-in user's account.
// Deploy with: supabase functions deploy delete-account
// Both app stores require in-app account deletion. Deleting the auth user
// cascades to everything keyed on it (profile, receipts and their items,
// participants and selections, scan usage). Storage files don't cascade, so
// the transfer slips friends sent for the user's bills are removed first.
// The admin API needs the service role key, which Supabase provides to Edge
// Functions and which must never ship in the app.

import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

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

/** Removes every slip photo on the user's bills. False if some could not be removed. */
async function removeSlips(userId: string): Promise<boolean> {
  const { data, error } = await admin.rpc('slip_files_for_user', { p_user_id: userId })
  // Before the payment_slips migration there are no slips to remove.
  if (error?.code === 'PGRST202') return true
  if (error) {
    console.error('Listing slips failed:', error)
    return false
  }
  const names = ((data ?? []) as { name: string }[]).map((file) => file.name)
  for (let i = 0; i < names.length; i += 1000) {
    const { error } = await admin.storage.from('slips').remove(names.slice(i, i + 1000))
    if (error) {
      console.error('Removing slips failed:', error)
      return false
    }
  }
  return true
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // The gateway's JWT check also accepts the public anon key, so confirm a
  // real user and only ever delete that user.
  const token = req.headers.get('Authorization')?.replace(/^Bearer /i, '')
  const { data: auth } = token ? await supabase.auth.getUser(token) : { data: { user: null } }
  if (!auth.user) return json({ error: 'Sign in to delete your account' }, 401)

  if (!(await removeSlips(auth.user.id))) return json({ error: 'Could not delete the account' }, 500)

  const { error } = await admin.auth.admin.deleteUser(auth.user.id)
  if (error) {
    console.error('deleteUser failed:', error)
    return json({ error: 'Could not delete the account' }, 500)
  }
  return json({ deleted: true })
})
