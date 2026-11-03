import { Platform, Share } from 'react-native'

import { strings } from '@/i18n/strings'
import { showAlert } from '@/lib/alert'

export async function shareText(message: string) {
  try {
    await Share.share({ message })
  } catch (e) {
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
