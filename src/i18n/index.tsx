import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Platform } from 'react-native'

import { secureStorage } from '@/lib/secure-storage'

import { applyLanguage, stringsFor, type Language, type Strings } from './strings'

export { dateLocale, strings, type Language, type Strings } from './strings'

const STORAGE_KEY = 'slipshare.language'

/** Thai when the phone or browser is set to Thai, otherwise English. */
function deviceLanguage(): Language {
  try {
    const tag =
      Platform.OS === 'web' && typeof navigator !== 'undefined'
        ? navigator.language
        : Intl.DateTimeFormat().resolvedOptions().locale
    return tag?.toLowerCase().startsWith('th') ? 'th' : 'en'
  } catch {
    return 'en'
  }
}

async function savedLanguage(): Promise<Language | null> {
  try {
    const saved = await secureStorage.getItem(STORAGE_KEY)
    return saved === 'en' || saved === 'th' ? saved : null
  } catch {
    return null
  }
}

interface LanguageState {
  language: Language
  setLanguage: (language: Language) => void
}

const LanguageContext = createContext<LanguageState>({ language: 'en', setLanguage: () => {} })

/**
 * Holds the app's language: the one picked on sign-in or in Account, or the
 * phone's own if none was picked. Shows nothing until it's loaded, while the
 * splash screen is still up, so text doesn't flip from English to Thai.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setState] = useState<Language | null>(null)

  useEffect(() => {
    savedLanguage().then((saved) => {
      const language = saved ?? deviceLanguage()
      applyLanguage(language)
      setState(language)
    })
  }, [])

  // Browsers pick Thai fonts and line breaks from the page's language.
  useEffect(() => {
    if (Platform.OS === 'web' && language && typeof document !== 'undefined') document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((next: Language) => {
    applyLanguage(next)
    setState(next)
    secureStorage.setItem(STORAGE_KEY, next).catch((e) => console.error('Could not save language', e))
  }, [])

  const value = useMemo(() => (language ? { language, setLanguage } : null), [language, setLanguage])
  if (!value) return null
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export const useLanguage = () => useContext(LanguageContext)

/** The app's words in the language the person picked. */
export function useT(): Strings {
  return stringsFor(useLanguage().language)
}
