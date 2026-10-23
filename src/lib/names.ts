// Receipts can carry the printed names and an English translation. These pick
// which one leads, and label the language switch.

const THAI = /[฀-๿]/

/** Longest name on a bill; the database allows 40 too. */
export const MAX_NAME_LENGTH = 40

/** A typed name with outer spaces trimmed, inner runs of spaces made one, and cut to MAX_NAME_LENGTH. */
export const cleanName = (typed: string) => typed.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH).trim()

/** "ไทย" when the printed names are Thai, otherwise "Original". */
export function originalLabel(names: (string | null | undefined)[]): string {
  return names.some((name) => name && THAI.test(name)) ? 'ไทย' : 'Original'
}

/** The name to show first, and the other one (if different) to show under it. */
export function bothNames(original: string | null, english: string | null, showEnglish: boolean) {
  const main = (showEnglish && english ? english : original || english) || ''
  const other = showEnglish ? original : english
  return { main, other: other && other !== main ? other : null }
}
