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
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8
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
