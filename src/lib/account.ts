import { supabase } from '@/lib/supabase'

/**
 * Permanently deletes the signed-in user and everything that belongs to them
 * (see supabase/functions/delete-account), then clears this device's session.
 */
export async function deleteAccount() {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' })
  if (error) throw error
  // The user is already gone on the server, so only the local copy is left.
  await supabase.auth.signOut({ scope: 'local' })
}
