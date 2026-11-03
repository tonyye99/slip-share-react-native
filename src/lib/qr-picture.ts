import * as Clipboard from 'expo-clipboard'
import * as Sharing from 'expo-sharing'
import type { RefObject } from 'react'
import { Platform, Share, type ViewInstance } from 'react-native'
import { captureRef } from 'react-native-view-shot'

export interface TotalsPicture {
  card: RefObject<ViewInstance | null>
  caption: string[]
  note: string
  fileName: string
  title: string
}

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

export const pastesMessage = Platform.OS === 'android'
