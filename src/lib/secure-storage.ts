import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

// SecureStore warns above ~2KB per value and Supabase sessions are larger,
// so values are split across numbered keys.
const CHUNK_SIZE = 1800

async function getItem(key: string): Promise<string | null> {
  const count = await SecureStore.getItemAsync(`${key}.count`)
  if (count === null) return null
  const chunks = await Promise.all(
    Array.from({ length: Number(count) }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)),
  )
  if (chunks.some((chunk) => chunk === null)) return null
  return chunks.join('')
}

async function removeItem(key: string): Promise<void> {
  const count = await SecureStore.getItemAsync(`${key}.count`)
  if (count === null) return
  await Promise.all(
    Array.from({ length: Number(count) }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`)),
  )
  await SecureStore.deleteItemAsync(`${key}.count`)
}

async function setItem(key: string, value: string): Promise<void> {
  await removeItem(key)
  const chunks = value.match(new RegExp(`[\\s\\S]{1,${CHUNK_SIZE}}`, 'g')) ?? ['']
  await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}.${i}`, chunk)))
  await SecureStore.setItemAsync(`${key}.count`, String(chunks.length))
}

const webStorage = {
  getItem: async (key: string) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(key)),
  setItem: async (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: async (key: string) => localStorage.removeItem(key),
}

export const secureStorage = Platform.OS === 'web' ? webStorage : { getItem, setItem, removeItem }
