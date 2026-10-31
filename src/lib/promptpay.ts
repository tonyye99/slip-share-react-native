// PromptPay, Thailand's instant transfer by phone number or ID. Its QR code
// (Thai QR Payment, built on the EMVCo standard) can carry an amount, so a
// friend's banking app opens with exactly what they owe filled in.

export type PromptPayKind = 'phone' | 'id' | 'ewallet'

/** Digits only, with +66 turned back into 0: "+66 81 234 5678" -> "0812345678". */
export function normalizePromptPay(input: string): string {
  const digits = input.replace(/\D/g, '')
  return input.trim().startsWith('+66') ? `0${digits.slice(2)}` : digits
}

/** What a PromptPay number is, or null if it can't be one. Takes digits from normalizePromptPay. */
export function promptPayKind(digits: string): PromptPayKind | null {
  if (/^0\d{9}$/.test(digits)) return 'phone'
  if (/^\d{13}$/.test(digits)) return 'id'
  if (/^\d{15}$/.test(digits)) return 'ewallet'
  return null
}

/**
 * A Thai national ID or tax ID ends in a check digit, so a typo almost
 * always shows up here instead of sending money to someone else.
 */
export function validThaiId(digits: string): boolean {
  if (!/^\d{13}$/.test(digits)) return false
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(digits[i]) * (13 - i)
  return (11 - (sum % 11)) % 10 === Number(digits[12])
}

export function validPromptPay(digits: string): boolean {
  const kind = promptPayKind(digits)
  return kind === 'id' ? validThaiId(digits) : kind !== null
}

/** "0812345678" -> "081-234-5678", "1234567890121" -> "1-2345-67890-12-1". */
export function formatPromptPay(digits: string): string {
  const kind = promptPayKind(digits)
  if (kind === 'phone') return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  if (kind === 'id') {
    return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits[12]}`
  }
  return digits
}

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`

/** CRC-16/CCITT-FALSE, the checksum at the end of every EMVCo QR. */
export function crc16(text: string): string {
  let crc = 0xffff
  // Over the UTF-8 bytes, so a shop QR with its Thai name (tag 64) still checks.
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/**
 * The text inside a PromptPay QR. With an amount (in baht) the friend's
 * banking app fills it in; without one they type it.
 */
export function promptPayPayload(digits: string, amount?: number): string {
  const kind = promptPayKind(digits)
  if (!kind) throw new Error('Not a PromptPay number')
  // Phone numbers go in as 0066 and the number without its leading 0.
  const account = kind === 'phone' ? `0066${digits.slice(1)}` : digits
  const tag = kind === 'phone' ? '01' : kind === 'id' ? '02' : '03'
  const withAmount = amount !== undefined && amount > 0
  let payload =
    field('00', '01') +
    // 12 means the code is for one payment, 11 that it can be used again.
    field('01', withAmount ? '12' : '11') +
    field('29', field('00', 'A000000677010111') + field(tag, account)) +
    field('58', 'TH') +
    field('53', '764')
  if (withAmount) payload += field('54', amount.toFixed(2))
  payload += '6304'
  return payload + crc16(payload)
}

// ============ QR codes saved from a banking app ============

export interface EmvField {
  id: string
  value: string
}

/** Splits QR text into its fields (two-digit id, two-digit length, value), or null if the lengths don't add up. */
export function emvFields(text: string): EmvField[] | null {
  const fields: EmvField[] = []
  let at = 0
  while (at < text.length) {
    const id = text.slice(at, at + 2)
    const length = text.slice(at + 2, at + 4)
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(length)) return null
    const end = at + 4 + Number(length)
    if (end > text.length) return null
    fields.push({ id, value: text.slice(at + 4, end) })
    at = end
  }
  return fields
}

const sub = (fields: EmvField[] | null, id: string) => fields?.find((one) => one.id === id)?.value

/**
 * Puts the code back together with an amount (a one-time code) or without one
 * (a code that can be used again). Every other field stays as the bank made it.
 */
function rebuild(fields: EmvField[], amount?: number): string {
  const withAmount = amount !== undefined && amount > 0
  const kept = fields.filter((one) => one.id !== '01' && one.id !== '54' && one.id !== '63')
  const out: EmvField[] = []
  for (const one of kept) {
    out.push(one)
    // 12 means the code is for one payment, 11 that it can be used again.
    if (one.id === '00') out.push({ id: '01', value: withAmount ? '12' : '11' })
    // The amount goes right after the currency, as banks put it.
    if (one.id === '53' && withAmount) out.push({ id: '54', value: amount.toFixed(2) })
  }
  const body = out.map((one) => field(one.id, one.value)).join('') + '6304'
  return body + crc16(body)
}

/** A PromptPay QR from a banking app, read and checked. */
export interface BankQr {
  /** The code without an amount, as saved: friends' amounts get added to it. */
  payload: string
  /** The PromptPay number inside it, as digits, when it has one. Some banks use an account code instead. */
  id: string | null
  /** The name the bank put in the code, like "YE HTET A.". */
  name: string | null
}

/**
 * Reads the text of a QR saved from a banking app (My QR, Receive money).
 * Null unless it is a Thai QR Payment code in baht with a correct checksum,
 * so a friend's banking app will accept it.
 */
export function readBankQr(text: string): BankQr | null {
  const raw = text.trim()
  if (!raw.startsWith('000201') || raw.length > 512) return null
  const fields = emvFields(raw)
  const crc = fields?.at(-1)
  if (!fields || crc?.id !== '63' || crc.value.length !== 4) return null
  if (crc16(raw.slice(0, -4)) !== crc.value.toUpperCase()) return null
  const currency = sub(fields, '53')
  if (currency !== undefined && currency !== '764') return null
  // Tag 29 is a PromptPay transfer, tag 30 a bill payment (shop QRs).
  const account = fields.find(
    (one) => (one.id === '29' || one.id === '30') && sub(emvFields(one.value), '00')?.startsWith('A000000677'),
  )
  if (!account) return null

  let id: string | null = null
  if (account.id === '29') {
    const inside = emvFields(account.value)
    const phone = sub(inside, '01')
    const national = sub(inside, '02')
    const wallet = sub(inside, '03')
    if (phone && /^0066\d{9}$/.test(phone)) id = `0${phone.slice(4)}`
    else if (national && /^\d{13}$/.test(national)) id = national
    else if (wallet && /^\d{15}$/.test(wallet)) id = wallet
  }
  const name = sub(fields, '59')?.trim() || null
  return { payload: rebuild(fields), id, name }
}

/** True when a saved PromptPay value is a bank's QR rather than a number. */
export const isBankQr = (value: string) => value.startsWith('000201')

/** The PromptPay number to show and copy, or null for a bank QR without one. */
export function promptPayId(value: string): string | null {
  return isBankQr(value) ? (readBankQr(value)?.id ?? null) : value
}

/** The QR friends scan: the saved number or bank QR, with their amount in it. */
export function payPayload(value: string, amount?: number): string {
  if (!isBankQr(value)) return promptPayPayload(value, amount)
  const fields = emvFields(value)
  if (!fields) throw new Error('Not a PromptPay QR')
  return rebuild(fields, amount)
}
