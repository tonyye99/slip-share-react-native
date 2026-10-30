import type { PayDetails, PayMethodKind } from '@/lib/pay-lines'
import { supabase } from '@/lib/supabase'

// How to pay me: the ways you get paid back, kept in the pay_methods table
// (supabase/migrations/*_pay_methods.sql). Only you can read or change them;
// friends see them through get_link_receipt on bills you paid.

export type { PayDetails, PayMethodKind }

export interface PayMethod extends PayDetails {
  id: string
  position: number
}

const COLUMNS = 'id, kind, value, bank, name, position'

/** The most anyone can add; the database checks it too (limit_pay_methods). */
export const MAX_PAY_METHODS = 10

/** Your ways to get paid, first one first. */
export async function listPayMethods(): Promise<PayMethod[]> {
  const { data, error } = await supabase
    .from('pay_methods')
    .select(COLUMNS)
    .order('position')
    .order('created_at')
  if (error) {
    // Until the pay_methods migration runs there is no table, and nothing to show.
    if (isMissingTable(error)) return []
    throw error
  }
  return data as PayMethod[]
}

export async function getPayMethod(id: string): Promise<PayMethod | null> {
  const { data, error } = await supabase.from('pay_methods').select(COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data as PayMethod | null
}

/** Adds one at the end of the list. */
export async function addPayMethod(method: PayDetails): Promise<PayMethod> {
  const { data: last, error: lastError } = await supabase
    .from('pay_methods')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lastError) throw lastError
  const position = last ? last.position + 1 : 0
  const { data, error } = await supabase
    .from('pay_methods')
    .insert({ kind: method.kind, value: method.value, bank: method.bank, name: method.name, position })
    .select(COLUMNS)
    .single()
  if (error) throw error
  return data as PayMethod
}

export async function updatePayMethod(id: string, method: Pick<PayDetails, 'value' | 'bank' | 'name'>) {
  const { error } = await supabase
    .from('pay_methods')
    .update({ value: method.value, bank: method.bank, name: method.name })
    .eq('id', id)
  if (error) throw error
}

export async function removePayMethod(id: string) {
  const { error } = await supabase.from('pay_methods').delete().eq('id', id)
  if (error) throw error
}

const isMissingTable = (error: { code?: string }) => error.code === 'PGRST205' || error.code === '42P01'

/** The database turns away an 11th one (limit_pay_methods). */
export const isTooMany = (error: unknown) => (error as { code?: string })?.code === 'P0001'
