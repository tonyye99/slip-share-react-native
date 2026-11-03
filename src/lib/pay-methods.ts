import type { PayDetails, PayMethodKind } from '@/lib/pay-lines'
import { supabase } from '@/lib/supabase'

export type { PayDetails, PayMethodKind }

export interface PayMethod extends PayDetails {
  id: string
  position: number
}

const COLUMNS = 'id, kind, value, bank, name, position'

export const MAX_PAY_METHODS = 10

export async function listPayMethods(): Promise<PayMethod[]> {
  const { data, error } = await supabase
    .from('pay_methods')
    .select(COLUMNS)
    .order('position')
    .order('created_at')
  if (error) {
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

export const isTooMany = (error: unknown) => (error as { code?: string })?.code === 'P0001'
