import * as Clipboard from 'expo-clipboard'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { Platform, Share } from 'react-native'

import { qrPng } from '@/lib/png'
import { qrModules } from '@/lib/qr'

export interface QrPicture {
  /** Lines under the code. Only the website draws them; the phone app has no canvas. */
  caption: string[]
  fileName: string
  title: string
}

/**
 * Opens the share sheet with the message and the QR code as a picture, for a
 * LINE group or a chat. Returns false when the person closed it without sending.
 *
 * iPhone sends both together. Android shares a picture without its text, so
 * the message goes on the clipboard first and the sheet says to paste it.
 */
export async function shareWithQr(message: string, qr: string, picture: QrPicture): Promise<boolean> {
  const file = new File(Paths.cache, picture.fileName)
  if (file.exists) file.delete()
  file.create()
  file.writeSync(qrPng(qrModules(qr), 12))

  if (Platform.OS === 'ios') {
    const result = await Share.share({ message, url: file.uri })
    return result.action !== Share.dismissedAction
  }
  await Clipboard.setStringAsync(message)
  await Sharing.shareAsync(file.uri, { mimeType: 'image/png', dialogTitle: picture.title })
  return true
}

/** Android can't send the message with the picture, so it's copied to paste. */
export const pastesMessage = Platform.OS === 'android'
