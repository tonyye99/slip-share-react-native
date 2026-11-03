import { strings } from '../i18n/strings.ts'
import { formatPromptPay, payPayload, promptPayId } from './promptpay.ts'

export type PayMethodKind = 'promptpay' | 'bank' | 'note'

export interface PayDetails {
  kind: PayMethodKind
  value: string
  bank: string | null
  name: string | null
}

export function payTitle(method: PayDetails): string {
  const t = strings().pay
  if (method.kind === 'promptpay') return t.promptpay
  if (method.kind === 'bank') return method.bank || t.bank
  return t.noteTitle
}

export function paySubtitle(method: PayDetails): string {
  if (method.kind === 'note') return method.value
  const number = method.kind === 'promptpay' ? promptPayNumber(method.value) : method.value
  return method.name ? `${number} · ${method.name}` : number
}

function promptPayNumber(value: string): string {
  const id = promptPayId(value)
  return id ? formatPromptPay(id) : strings().pay.bankQr
}

export function payLines(methods: PayDetails[]): string[] {
  const t = strings().totals
  return methods.map((method) => {
    if (method.kind === 'promptpay') {
      const id = promptPayId(method.value)
      return id ? t.promptpay(formatPromptPay(id), method.name) : t.promptpayQr(method.name)
    }
    if (method.kind === 'bank') return t.bank(method.bank ?? '', method.value, method.name)
    return method.value
  })
}

export function withPayMe(message: string, methods: PayDetails[]): string {
  if (methods.length === 0) return message
  return [message, '', strings().totals.payMe, ...payLines(methods)].join('\n')
}

export function groupPayQr(
  methods: PayDetails[],
  currency: string,
): { payload: string; id: string | null; name: string | null } | null {
  if (currency.toUpperCase() !== 'THB') return null
  const method = methods.find((one) => one.kind === 'promptpay')
  if (!method) return null
  return { payload: payPayload(method.value), id: promptPayId(method.value), name: method.name }
}

const BANK_ACCOUNT = /^[0-9A-Za-z][0-9A-Za-z -]{3,40}$/

export function cleanBankAccount(text: string): string | null {
  const account = text.trim().replace(/\s+/g, ' ')
  return BANK_ACCOUNT.test(account) ? account : null
}

export function cleanText(text: string): string | null {
  return text.trim().replace(/\s+/g, ' ') || null
}
