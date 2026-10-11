// Receipts can carry the printed names and an English translation. These pick
// which one leads, and label the language switch.

const THAI = /[฀-๿]/

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
