import { Platform, Share } from 'react-native'

import { strings } from '@/i18n/strings'
import { showAlert } from '@/lib/alert'

/**
 * Copies a number or an amount. Returns true when it's on the clipboard, so
 * the button can say "Copied". The phone app has no clipboard of its own,
 * so it opens the share sheet, which has Copy.
 */
export async function copyText(text: string): Promise<boolean> {
  if (Platform.OS !== 'web') {
    await Share.share({ message: text }).catch((e) => console.error('Share failed', e))
    return false
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
