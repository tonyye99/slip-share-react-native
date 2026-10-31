import { en, type Strings } from './en.ts'
import { th } from './th.ts'

// The words for the app's language. Components read them with useT() from
// '@/i18n'; plain code (alerts, share text, the pure helpers in lib/) calls
// strings(), which follows the same choice.

export type Language = 'en' | 'th'
export type { Strings }

const dictionaries: Record<Language, Strings> = { en, th }

let current: Language = 'en'

export const stringsFor = (language: Language): Strings => dictionaries[language]

/** The words in the language the person picked. English until the app has loaded their choice. */
export const strings = (): Strings => dictionaries[current]

/** Only the LanguageProvider calls this, so screens re-render as it changes. */
export function applyLanguage(language: Language) {
  current = language
}

/** For dates: Thai month names in Thai, otherwise the phone's own way of writing dates. */
export const dateLocale = (): string | undefined => (current === 'th' ? 'th-TH' : undefined)
