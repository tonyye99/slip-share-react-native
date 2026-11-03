import type { User } from '@supabase/supabase-js'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { Platform } from 'react-native'

import { supabase } from '@/lib/supabase'

export const authCallbackUrl = () => Linking.createURL('auth/callback')

export const resetPasswordUrl = () => Linking.createURL('reset-password')

export interface AuthRedirectParams {
  code?: string | string[]
  error?: string | string[]
  error_description?: string | string[]
}

const firstParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

const codeExchanges = new Map<string, Promise<void>>()

export function completeAuthRedirect(params: AuthRedirectParams): Promise<void> {
  const error = firstParam(params.error_description) ?? firstParam(params.error)
  if (error) return Promise.reject(new Error(error))
  const code = firstParam(params.code)
  if (!code) return Promise.reject(new Error('This link is missing its sign-in code.'))

  let exchange = codeExchanges.get(code)
  if (!exchange) {
    exchange = supabase.auth.exchangeCodeForSession(code).then(({ data, error: exchangeError }) => {
      if (exchangeError) throw exchangeError
      return ensureDisplayName(data.user)
    })
    codeExchanges.set(code, exchange)
  }
  return exchange
}

export async function signInWithProvider(provider: 'google'): Promise<boolean> {
  const redirectTo = authCallbackUrl()
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })
    if (error) throw error
    return new Promise<boolean>(() => {})
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  })
  if (error) throw error

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
  if (result.type !== 'success') return false
  await completeAuthRedirect(Linking.parse(result.url).queryParams ?? {})
  return true
}

export async function signInWithApple(): Promise<boolean> {
  const rawNonce = Crypto.randomUUID()
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce)

  let credential: AppleAuthentication.AppleAuthenticationCredential
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    })
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false
    throw e
  }
  if (!credential.identityToken) throw new Error('Apple did not return a sign-in token.')

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  })
  if (error) throw error

  const name = credential.fullName ? AppleAuthentication.formatFullName(credential.fullName) : ''
  await ensureDisplayName(data.user, name)
  return true
}

async function ensureDisplayName(user: User | null, preferred?: string): Promise<void> {
  if (!user) return
  const metadata = user.user_metadata ?? {}
  const name = [preferred, metadata.display_name, metadata.full_name, metadata.name, user.email?.split('@')[0]]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean)
  if (!name) return

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: name })
    .eq('user_id', user.id)
    .is('display_name', null)
  if (error) console.warn('Could not set display name', error)
}
