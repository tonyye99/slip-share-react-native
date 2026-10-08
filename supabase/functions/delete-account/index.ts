// Supabase Edge Function: deletes the signed-in user's account.
// Deploy with: supabase functions deploy delete-account
// Both app stores require in-app account deletion. Deleting the auth user
// cascades to everything keyed on it (profile, receipts and their items,
// participants and selections, scan usage), so nothing else needs removing.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // The gateway's JWT check also accepts the public anon key, so confirm a
  // real user and only ever delete that user.
  const token = req.headers.get('Authorization')?.replace(/^Bearer /i, '')
  const { data: auth } = token ? await supabase.auth.getUser(token) : { data: { user: null } }
  if (!auth.user) return json({ error: 'Sign in to delete your account' }, 401)

  const { error } = await admin.auth.admin.deleteUser(auth.user.id)
  if (error) {
    console.error('deleteUser failed:', error)
    return json({ error: 'Could not delete the account' }, 500)
  }
  return json({ deleted: true })
})
