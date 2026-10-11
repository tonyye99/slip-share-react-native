import { Platform } from 'react-native'

import { secureStorage } from '@/lib/secure-storage'
import { supabase } from '@/lib/supabase'

// The friend link: https://<site>/pick/<token> opens the website, where
// friends type their name and tick their own items without signing in.
// Everything goes through the get_link_receipt, join_link and set_link_pick
// functions in supabase/migrations, which check the token on every call.

export interface LinkPerson {
  id: string
  /** The owner's line shows their display name. */
  name: string
  is_owner: boolean
  is_payer: boolean
  paid: boolean
  /** Someone already picked this name through the link. */
  claimed: boolean
}

export interface LinkItem {
  id: string
  name: string
  name_en: string | null
  qty: number
  unit_price: number
  person_ids: string[]
}

export interface LinkReceipt {
  merchant_name: string | null
  merchant_name_en: string | null
  currency: string
  tax_percent: number
  service_percent: number
  rounding: number
  subtotal: number
  total: number
  items: LinkItem[]
  people: LinkPerson[]
}

/** Who you are on a link. This device keeps it so you can come back later. */
export interface LinkIdentity {
  person_id: string
  guest_key: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isLinkToken = (value: string | undefined): value is string => !!value && UUID.test(value)

// The phone app needs the website's address to make links; the website uses its own.
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL?.trim().replace(/\/+$/, '')

/** False in the phone app until EXPO_PUBLIC_WEB_URL points at the published website. */
export const friendLinksAvailable = Platform.OS === 'web' || !!WEB_URL

export function friendLinkUrl(token: string): string {
  const site = Platform.OS === 'web' ? window.location.origin : WEB_URL
  return `${site}/pick/${token}`
}

export async function getLinkReceipt(token: string): Promise<LinkReceipt> {
  const { data, error } = await supabase.rpc('get_link_receipt', { p_token: token })
  if (error) throw error
  return data as LinkReceipt
}

/** Joins as a name the owner already added, or as a new person. */
export async function joinLink(token: string, choice: { personId: string } | { name: string }): Promise<LinkIdentity> {
  const { data, error } = await supabase.rpc('join_link', {
    p_token: token,
    p_person_id: 'personId' in choice ? choice.personId : null,
    p_name: 'name' in choice ? choice.name : null,
  })
  if (error) throw error
  const identity = data as LinkIdentity
  await secureStorage.setItem(identityKey(token), JSON.stringify(identity))
  return identity
}

export async function setLinkPick(token: string, identity: LinkIdentity, itemId: string, had: boolean) {
  const { error } = await supabase.rpc('set_link_pick', {
    p_token: token,
    p_person_id: identity.person_id,
    p_guest_key: identity.guest_key,
    p_item_id: itemId,
    p_had: had,
  })
  if (error) throw error
}

const identityKey = (token: string) => `slipshare.link.${token}`

export async function loadIdentity(token: string): Promise<LinkIdentity | null> {
  try {
    const saved = await secureStorage.getItem(identityKey(token))
    return saved ? (JSON.parse(saved) as LinkIdentity) : null
  } catch {
    return null
  }
}

export async function forgetIdentity(token: string) {
  try {
    await secureStorage.removeItem(identityKey(token))
  } catch (e) {
    console.error('Could not forget link name', e)
  }
}

/** The database says this browser's key no longer matches (the owner removed them). */
export const isIdentityRejected = (e: unknown) => (e as { code?: string })?.code === '42501'

/** A message worth showing for a failed join; the database's own text for the cases it explains. */
export function joinErrorMessage(e: unknown): string {
  const { code, message } = (e as { code?: string; message?: string }) ?? {}
  if (message && (code === 'P0002' || code === '23505' || code === '54000')) return `${message}.`
  return 'Check your connection and try again.'
}
