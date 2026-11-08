export interface NameLine {
  text: string
  text_en?: string
  starts_item: boolean
}

export interface ScanItem {
  id: string
  name: string
  name_en?: string
  qty: number
  line_total: number
}

export interface Reading {
  is_receipt: boolean
  price_column: number[]
  name_lines?: NameLine[]
  items: { line_total: number }[]
  total: number
  service_percent: number
  service_amount: number
  tax_percent: number
  rounding: number
}

const TOLERANCE = 1

const sum = (amounts: number[]) => amounts.reduce((total, amount) => total + amount, 0)
const lineTotals = (reading: Reading) => reading.items.map((item) => item.line_total)
const itemsSum = (reading: Reading) => sum(lineTotals(reading))

const beforeDiscounts = (amounts: number[]) => sum(amounts.filter((amount) => amount > 0))

function missWith(reading: Reading, items: number, services: number[]): number {
  const tax = reading.tax_percent / 100
  const totals = services.flatMap((service) => [items + service, (items + service) * (1 + tax), items * (1 + tax) + service])
  return Math.min(...totals.map((total) => Math.abs(total + reading.rounding - reading.total)))
}

function missFor(reading: Reading, amounts: number[]): number {
  if (reading.total <= 0) return 0
  if (reading.service_amount > 0) return missWith(reading, sum(amounts), [reading.service_amount])
  const rate = reading.service_percent / 100
  return missWith(reading, sum(amounts), [sum(amounts) * rate, beforeDiscounts(amounts) * rate])
}

export const missBy = (reading: Reading) => missFor(reading, lineTotals(reading))

export function groupLines(lines: NameLine[] = []): NameLine[][] {
  const groups: NameLine[][] = []
  for (const line of lines) {
    if (!line.text.trim()) continue
    if (line.starts_item || groups.length === 0) groups.push([line])
    else groups[groups.length - 1].push(line)
  }
  return groups
}

const nameGroups = (reading: Reading) => groupLines(reading.name_lines).length

export function readsRight(reading: Reading): boolean {
  if (!reading.is_receipt) return true
  if (reading.price_column.length > 0 && reading.price_column.length !== reading.items.length) return false
  if (nameGroups(reading) > 0 && nameGroups(reading) !== reading.items.length) return false
  return missBy(reading) < TOLERANCE
}

export function trustedColumn(reading: Reading): number[] | null {
  const column = reading.price_column
  if (!reading.is_receipt || reading.total <= 0 || column.length === 0) return null
  if (missFor(reading, column) < TOLERANCE) return column
  for (let i = 1; i < column.length; i++) {
    if (column[i] !== column[i - 1]) continue
    const once = [...column.slice(0, i), ...column.slice(i + 1)]
    if (missFor(reading, once) < TOLERANCE) return once
  }
  return null
}

export function withServiceAmount<T extends Reading>(reading: T): T {
  if (!reading.is_receipt || reading.total <= 0 || reading.service_amount > 0 || reading.service_percent <= 0) return reading
  const amounts = lineTotals(reading)
  const rate = reading.service_percent / 100
  const onItems = sum(amounts) * rate
  const onFullPrices = beforeDiscounts(amounts) * rate
  if (missWith(reading, sum(amounts), [onItems]) < TOLERANCE) return reading
  if (missWith(reading, sum(amounts), [onFullPrices]) >= TOLERANCE) return reading
  return { ...reading, service_amount: Math.round(onFullPrices * 100) / 100 }
}

export function alignTo<T extends Reading>(reading: T, column: number[] | null): T {
  if (!column || reading.items.length !== column.length) return reading
  const items = reading.items.map((item, i) => ({ ...item, line_total: column[i] }))
  return { ...reading, price_column: column, items } as T
}

const plain = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '')
const joined = (lines: NameLine[], english: boolean) => lines.map((line) => (english ? (line.text_en ?? line.text) : line.text).trim()).join(' ')

function overlaps(a: string, b: string): boolean {
  const [x, y] = [plain(a), plain(b)]
  return x.length > 0 && y.length > 0 && (x.includes(y) || y.includes(x))
}

export function fromLines<T extends Reading & { items: ScanItem[] }>(reading: T, column: number[] | null): T {
  const aligned = alignTo(reading, column)
  const groups = groupLines(reading.name_lines)
  if (!column || groups.length !== column.length) return aligned
  const read: ScanItem[] = reading.items
  const names = groups.map((group) => joined(group, false))
  const same = read.length === names.length && names.every((name, i) => plain(name) === plain(read[i].name))
  if (same) return aligned
  const translated = read.some((item) => item.name_en !== undefined)
  const items = groups.map((group, i) => {
    const source = read.find((item) => overlaps(names[i], item.name))
    const item: ScanItem = { id: String(i + 1), name: names[i], qty: source?.qty ?? 1, line_total: column[i] }
    return translated ? { ...item, name_en: joined(group, true) } : item
  })
  return { ...reading, price_column: column, items } as T
}

const amount = (value: number) => value.toFixed(2)

function readTwice(column: number[], trusted: number[]): number | null {
  if (column.length !== trusted.length + 1) return null
  const i = trusted.findIndex((value, index) => value !== column[index])
  return column[i === -1 ? trusted.length : i]
}

export function recheckNote(reading: Reading, column: number[] | null): string {
  const service = reading.service_amount > 0 ? ` and a service charge of ${amount(reading.service_amount)}` : ''
  if (!column) {
    return [
      `A first reading of this receipt found ${reading.items.length} items adding up to ${amount(itemsSum(reading))},`,
      `with ${reading.price_column.length} amounts in the price column.`,
      `That does not fit the printed total of ${amount(reading.total)}${service}.`,
      'A line was probably dropped, merged with the next one, or matched to the wrong amount.',
      'Read the items again slowly, from the top, matching every amount in the price column to its own name.',
    ].join(' ')
  }
  const twice = readTwice(reading.price_column, column)
  return [
    `The price column of this receipt has exactly ${column.length} amounts, top to bottom: ${column.map(amount).join(', ')}.`,
    `They fit the printed total of ${amount(reading.total)}${service}.`,
    twice === null ? '' : `A first reading listed ${amount(twice)} twice in a row, but it is printed only once.`,
    reading.items.length === column.length
      ? `A first reading marked ${nameGroups(reading)} name lines as starting an item, so the names did not match the amounts.`
      : `A first reading found ${reading.items.length} items, so some name lines were split off, merged or dropped.`,
    `Give exactly ${column.length} items, one for each of these amounts, in this order, with these line_totals, and use these amounts as price_column.`,
    `In name_lines, mark exactly ${column.length} lines with starts_item true, one for each amount.`,
    'Every other line in the item list is part of an item name: a second line, often indented, belongs to the item it continues.',
    'A number inside a name, like the 59 in "Add on Drink 59 THB", is part of the name, not an amount.',
  ]
    .filter(Boolean)
    .join(' ')
}

export function describe(reading: Reading): string {
  const groups = nameGroups(reading) > 0 ? `, ${nameGroups(reading)} name groups` : ''
  return `${reading.items.length} items for ${reading.price_column.length} prices${groups}, ${amount(missBy(reading))} off the total`
}

export function better<T extends Reading>(first: T, second: T): T {
  if (!second.is_receipt) return first
  if (readsRight(second)) return second
  return missBy(second) < missBy(first) ? second : first
}
