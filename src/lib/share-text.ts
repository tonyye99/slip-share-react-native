import { Platform, Share } from 'react-native'

import { strings } from '@/i18n/strings'
import { showAlert } from '@/lib/alert'

/**
 * Opens the share sheet with some text, for LINE, WhatsApp and the like.
 * Browsers without a share sheet (most desktops) copy it instead.
 */
export async function shareText(message: string) {
  try {
    await Share.share({ message })
  } catch (e) {
    // Closing the browser's share sheet counts as an error there.
    if ((e as Error)?.name === 'AbortError') return
    if (Platform.OS !== 'web') return console.error('Share failed', e)
    try {
      await navigator.clipboard.writeText(message)
      showAlert(strings().common.copied, strings().common.copiedMessage)
    } catch (copyError) {
      console.error('Copy failed', copyError)
      showAlert(strings().common.copyThis, message)
    }
  }
}
