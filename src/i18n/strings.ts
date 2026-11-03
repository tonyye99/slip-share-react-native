import { en, type Strings } from './en.ts'
import { th } from './th.ts'

export type Language = 'en' | 'th'
export type { Strings }

const dictionaries: Record<Language, Strings> = { en, th }

let current: Language = 'en'

export const stringsFor = (language: Language): Strings => dictionaries[language]

export const strings = (): Strings => dictionaries[current]

export function applyLanguage(language: Language) {
  current = language
}

export const dateLocale = (): string | undefined => (current === 'th' ? 'th-TH' : undefined)
