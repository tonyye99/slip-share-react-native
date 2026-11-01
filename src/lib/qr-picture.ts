import * as Clipboard from 'expo-clipboard'
import * as Sharing from 'expo-sharing'
import type { RefObject } from 'react'
import { Platform, Share, type ViewInstance } from 'react-native'
import { captureRef } from 'react-native-view-shot'

export interface TotalsPicture {
  /** The card on screen (TotalsCard). The phone app shares a picture of it. */
  card: RefObject<ViewInstance | null>
  /** The name, then the PromptPay number. The website draws these itself. */
  caption: string[]
  /** The line under the code. */
  note: string
  fileName: string
  title: string
}

/**
 * Opens the share sheet with the message and the totals card as a picture,
 * for a LINE group or a chat. The picture holds the message too, so apps
 * that keep only the picture still get every amount. Returns false when the
 * person closed the sheet without sending.
 *
 * iPhone sends both together. Android shares a picture without its text, so
 * the message goes on the clipboard first and the sheet says to paste it.
 */
export async function shareWithQr(message: string, _qr: string, picture: TotalsPicture): Promise<boolean> {
  const uri = await captureRef(picture.card, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    fileName: picture.fileName.replace(/\.png$/, ''),
  })

  if (Platform.OS === 'ios') {
    const result = await Share.share({ message, url: uri })
    return result.action !== Share.dismissedAction
  }
  await Clipboard.setStringAsync(message)
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: picture.title })
  return true
}

/** Android can't send the message with the picture, so it's copied to paste. */
export const pastesMessage = Platform.OS === 'android'
