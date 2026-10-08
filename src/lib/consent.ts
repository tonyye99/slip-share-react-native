import * as WebBrowser from 'expo-web-browser'

import { supabase } from '@/lib/supabase'

export const PRIVACY_POLICY_URL = 'https://github.com/tonyye99/slip-share-react-native/blob/main/PRIVACY.md'

export function openPrivacyPolicy() {
  return WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL)
}

/**
 * When the signed-in user agreed to send receipt photos to OpenAI, or null if
 * they haven't. parse-receipt checks the same ai_consents row on the server.
 */
export async function getAiConsent(): Promise<string | null> {
  const { data, error } = await supabase.from('ai_consents').select('consented_at').maybeSingle()
  if (error) throw error
  return data?.consented_at ?? null
}

export async function giveAiConsent(userId: string) {
  // The date comes from the database, so only user_id is sent.
  const { error } = await supabase
    .from('ai_consents')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })
  if (error) throw error
}

export async function withdrawAiConsent(userId: string) {
  const { error } = await supabase.from('ai_consents').delete().eq('user_id', userId)
  if (error) throw error
}
