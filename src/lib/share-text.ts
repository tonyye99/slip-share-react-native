import { Platform, Share } from 'react-native'

import { strings } from '@/i18n/strings'
import { showAlert } from '@/lib/alert'

export async function shareText(message: string): Promise<boolean> {
  try {
    const result: { action?: string } | undefined = await Share.share({ message })
    return result?.action !== Share.dismissedAction
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return false
    if (Platform.OS !== 'web') {
      console.error('Share failed', e)
      return false
    }
    try {
      await navigator.clipboard.writeText(message)
      showAlert(strings().common.copied, strings().common.copiedMessage)
      return true
    } catch (copyError) {
      console.error('Copy failed', copyError)
      showAlert(strings().common.copyThis, message)
      return false
    }
  }
}
