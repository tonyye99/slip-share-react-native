// How to pay me, as text: the lines Send totals and Remind add, and the
// titles the app shows for each way to get paid. Kept free of React and
// Supabase so the tests can run it.

import { strings } from '../i18n/strings.ts'
import { formatPromptPay } from './promptpay.ts'

export type PayMethodKind = 'promptpay' | 'bank' | 'note'

/** One way to get paid, as friends see it. */
export interface PayDetails {
  kind: PayMethodKind
  /** PromptPay: digits only. Bank: the account number. Note: the text. */
  value: string
  /** Bank only. */
  bank: string | null
  /** The name friends see, for PromptPay and bank accounts. */
  name: string | null
}

/** "PromptPay", "Kasikorn Bank" or "Note". */
export function payTitle(method: PayDetails): string {
  const t = strings().pay
  if (method.kind === 'promptpay') return t.promptpay
  if (method.kind === 'bank') return method.bank || t.bank
  return t.noteTitle
}

/** The line under the title: "081-234-5678 · Ye H.", or the note itself. */
export function paySubtitle(method: PayDetails): string {
  if (method.kind === 'note') return method.value
  const number = method.kind === 'promptpay' ? formatPromptPay(method.value) : method.value
  return method.name ? `${number} · ${method.name}` : number
}

/** One line for each way to pay, like "PromptPay 081-234-5678 (Ye H.)". */
export function payLines(methods: PayDetails[]): string[] {
  const t = strings().totals
  return methods.map((method) => {
    if (method.kind === 'promptpay') return t.promptpay(formatPromptPay(method.value), method.name)
    if (method.kind === 'bank') return t.bank(method.bank ?? '', method.value, method.name)
    return method.value
  })
}

/**
 * Adds "Pay me" and your ways to get paid to a message for the group, then
 * the friend link if it's on, where each friend gets a QR for their own amount.
 */
export function withPayMe(message: string, methods: PayDetails[], link?: string | null): string {
  const t = strings().totals
  if (methods.length === 0) return message
  const extra = ['', t.payMe, ...payLines(methods)]
  if (link) extra.push('', t.link(link, methods.some((method) => method.kind === 'promptpay')))
  return [message, ...extra].join('\n')
}

/** Same rule as the database (pay_methods_bank): letters, digits, spaces and dashes. */
const BANK_ACCOUNT = /^[0-9A-Za-z][0-9A-Za-z -]{3,40}$/

/** "123-4-56789-0" with the spaces tidied, or null if it can't be an account number. */
export function cleanBankAccount(text: string): string | null {
  const account = text.trim().replace(/\s+/g, ' ')
  return BANK_ACCOUNT.test(account) ? account : null
}

/** A name or a bank with the spaces tidied, or null when it's empty. */
export function cleanText(text: string): string | null {
  return text.trim().replace(/\s+/g, ' ') || null
}
