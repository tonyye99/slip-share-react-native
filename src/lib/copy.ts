import * as Clipboard from 'expo-clipboard'
import { Platform } from 'react-native'

import { strings } from '@/i18n/strings'
import { showAlert } from '@/lib/alert'

export async function copyText(text: string): Promise<boolean> {
  if (Platform.OS !== 'web') {
    try {
      await Clipboard.setStringAsync(text)
      return true
    } catch (e) {
      console.error('Copy failed', e)
      return false
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (e) {
    console.error('Copy failed', e)
    showAlert(strings().common.copyThis, text)
    return false
  }
}
