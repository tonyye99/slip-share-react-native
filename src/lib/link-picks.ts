import { Platform } from 'react-native'

import { strings } from '@/i18n/strings'
import type { PayDetails } from '@/lib/pay-lines'
import { secureStorage } from '@/lib/secure-storage'
import { readSavedCharges } from '@/lib/split'
import { supabase } from '@/lib/supabase'

export interface LinkPerson {
  id: string
  name: string
  is_owner: boolean
  is_payer: boolean
  paid: boolean
  claimed: boolean
  slip_sent?: boolean
}

export interface LinkItem {
  id: string
  name: string
  name_en: string | null
  qty: number
  unit_price: number
  person_ids: string[]
  counts: Record<string, number>
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
  pay_methods?: PayDetails[]
}

export interface LinkIdentity {
  person_id: string
  guest_key: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isLinkToken = (value: string | undefined): value is string => !!value && UUID.test(value)

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL?.trim().replace(/\/+$/, '')

export const friendLinksAvailable = Platform.OS === 'web' || !!WEB_URL

export function friendLinkUrl(token: string): string {
  const site = Platform.OS === 'web' ? window.location.origin : WEB_URL
  return `${site}/pick/${token}`
}

export async function getLinkReceipt(token: string): Promise<LinkReceipt> {
  const { data, error } = await supabase.rpc('get_link_receipt', { p_token: token })
  if (error) throw error
  return readSavedCharges(data as LinkReceipt)
}

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

export async function setLinkPick(token: string, identity: LinkIdentity, itemId: string, had: boolean, units = 1) {
  const { error } = await supabase.rpc('set_link_pick', {
    p_token: token,
    p_person_id: identity.person_id,
    p_guest_key: identity.guest_key,
    p_item_id: itemId,
    p_had: had,
    p_units: units,
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

export const isIdentityRejected = (e: unknown) => (e as { code?: string })?.code === '42501'

export function joinErrorMessage(e: unknown): string {
  const { code, message } = (e as { code?: string; message?: string }) ?? {}
  if (message && (code === 'P0002' || code === '23505' || code === '54000')) return `${message}.`
  return strings().common.checkConnection
}
