import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Platform } from 'react-native'

import { secureStorage } from '@/lib/secure-storage'

import { applyLanguage, stringsFor, type Language, type Strings } from './strings'

export { dateLocale, strings, type Language, type Strings } from './strings'

const STORAGE_KEY = 'slipshare.language'

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

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setState] = useState<Language | null>(null)

  useEffect(() => {
    savedLanguage().then((saved) => {
      const language = saved ?? deviceLanguage()
      applyLanguage(language)
      setState(language)
    })
  }, [])

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

export function useT(): Strings {
  return stringsFor(useLanguage().language)
}
