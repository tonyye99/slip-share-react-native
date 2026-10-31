import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'

import { qrPng } from '@/lib/png'
import { qrModules } from '@/lib/qr'

/**
 * Opens the share sheet with the QR code as a picture, for a LINE group or
 * a chat. The phone app has no canvas, so the picture is the code alone;
 * the website adds the name under it.
 */
export async function shareQrPicture(text: string, picture: { caption: string[]; fileName: string; title: string }) {
  const file = new File(Paths.cache, picture.fileName)
  if (file.exists) file.delete()
  file.create()
  file.writeSync(qrPng(qrModules(text), 12))
  await Sharing.shareAsync(file.uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: picture.title })
}
