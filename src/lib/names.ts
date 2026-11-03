const THAI = /[฀-๿]/

export const MAX_NAME_LENGTH = 40

export const cleanName = (typed: string) => typed.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH).trim()

export function originalLabel(names: (string | null | undefined)[], original: string): string {
  return names.some((name) => name && THAI.test(name)) ? 'ไทย' : original
}

const PLACEHOLDER = /^(unknown|n\/?a|none|null|-+|\?+|ไม่ทราบ|ไม่ระบุ)$/i

export const realName = (name: string | null | undefined) => {
  const trimmed = name?.replace(/^[\s*>#•·]+/, '').trim()
  return trimmed && !PLACEHOLDER.test(trimmed) ? trimmed : null
}

export function bothNames(printed: string | null, translated: string | null, showEnglish: boolean) {
  const original = realName(printed)
  const english = realName(translated)
  const main = (showEnglish && english ? english : original || english) || ''
  const other = showEnglish ? original : english
  return { main, other: other && other !== main ? other : null }
}
