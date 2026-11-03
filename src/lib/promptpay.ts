export type PromptPayKind = 'phone' | 'id' | 'ewallet'

export function normalizePromptPay(input: string): string {
  const digits = input.replace(/\D/g, '')
  return input.trim().startsWith('+66') ? `0${digits.slice(2)}` : digits
}

export function promptPayKind(digits: string): PromptPayKind | null {
  if (/^0\d{9}$/.test(digits)) return 'phone'
  if (/^\d{13}$/.test(digits)) return 'id'
  if (/^\d{15}$/.test(digits)) return 'ewallet'
  return null
}

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

export function formatPromptPay(digits: string): string {
  const kind = promptPayKind(digits)
  if (kind === 'phone') return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  if (kind === 'id') {
    return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits[12]}`
  }
  return digits
}

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`

export function crc16(text: string): string {
  let crc = 0xffff
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function promptPayPayload(digits: string, amount?: number): string {
  const kind = promptPayKind(digits)
  if (!kind) throw new Error('Not a PromptPay number')
  const account = kind === 'phone' ? `0066${digits.slice(1)}` : digits
  const tag = kind === 'phone' ? '01' : kind === 'id' ? '02' : '03'
  const withAmount = amount !== undefined && amount > 0
  let payload =
    field('00', '01') +
    field('01', withAmount ? '12' : '11') +
    field('29', field('00', 'A000000677010111') + field(tag, account)) +
    field('58', 'TH') +
    field('53', '764')
  if (withAmount) payload += field('54', amount.toFixed(2))
  payload += '6304'
  return payload + crc16(payload)
}

export interface EmvField {
  id: string
  value: string
}

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

function rebuild(fields: EmvField[], amount?: number): string {
  const withAmount = amount !== undefined && amount > 0
  const kept = fields.filter((one) => one.id !== '01' && one.id !== '54' && one.id !== '63')
  const out: EmvField[] = []
  for (const one of kept) {
    out.push(one)
    if (one.id === '00') out.push({ id: '01', value: withAmount ? '12' : '11' })
    if (one.id === '53' && withAmount) out.push({ id: '54', value: amount.toFixed(2) })
  }
  if (withAmount && !out.some((one) => one.id === '54')) {
    const at = out.findIndex((one) => Number(one.id) > 54)
    out.splice(at === -1 ? out.length : at, 0, { id: '53', value: '764' }, { id: '54', value: amount.toFixed(2) })
  }
  const body = out.map((one) => field(one.id, one.value)).join('') + '6304'
  return body + crc16(body)
}

export interface BankQr {
  payload: string
  id: string | null
  name: string | null
}

export function readBankQr(text: string): BankQr | null {
  const raw = text.trim()
  if (!raw.startsWith('000201') || raw.length > 512) return null
  const fields = emvFields(raw)
  const crc = fields?.at(-1)
  if (!fields || crc?.id !== '63' || crc.value.length !== 4) return null
  if (crc16(raw.slice(0, -4)) !== crc.value.toUpperCase()) return null
  const currency = sub(fields, '53')
  if (currency !== undefined && currency !== '764') return null
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

export const isBankQr = (value: string) => value.startsWith('000201')

export function promptPayId(value: string): string | null {
  return isBankQr(value) ? (readBankQr(value)?.id ?? null) : value
}

export function payPayload(value: string, amount?: number): string {
  if (!isBankQr(value)) return promptPayPayload(value, amount)
  const fields = emvFields(value)
  if (!fields) throw new Error('Not a PromptPay QR')
  return rebuild(fields, amount)
}
