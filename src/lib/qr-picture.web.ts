import { strings } from '@/i18n/strings'
import { showAlert } from '@/lib/alert'
import { download, totalsPicture } from '@/lib/qr'

import type { TotalsPicture } from './qr-picture'

export async function shareWithQr(message: string, qr: string, picture: TotalsPicture): Promise<boolean> {
  const blob = await totalsPicture(message, qr, picture.caption, picture.note)
  const file = new File([blob], picture.fileName, { type: 'image/png' })
  const both = { text: message, files: [file], title: picture.title }
  if (navigator.canShare?.(both)) {
    try {
      await navigator.share(both)
      return true
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return false
      if ((e as Error)?.name !== 'NotAllowedError') throw e
    }
  }

  const t = strings().totals
  download(blob, picture.fileName)
  try {
    await navigator.clipboard.writeText(message)
    showAlert(t.copiedTitle, t.copiedMessage)
  } catch (e) {
    console.error('Copy failed', e)
    showAlert(strings().common.copyThis, message)
  }
  return true
}

export const pastesMessage = false
