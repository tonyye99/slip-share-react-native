import 'react-native-url-polyfill/auto'

import { createClient } from '@supabase/supabase-js'
import { AppState, Platform } from 'react-native'

import { secureStorage } from '@/lib/secure-storage'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env (see .env.example)')
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // OAuth, email confirmation and password reset links come back to the
    // app with a ?code= that auth-links.ts exchanges for a session.
    flowType: 'pkce',
  },
})

// Only refresh the session while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh()
    else supabase.auth.stopAutoRefresh()
  })
}
