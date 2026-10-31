import { download, qrPicture } from '@/lib/qr'

/**
 * Opens the share sheet with the QR code as a picture, with the name under
 * it. Browsers that can't share files (most computers) download it instead.
 */
export async function shareQrPicture(text: string, picture: { caption: string[]; fileName: string; title: string }) {
  const blob = await qrPicture(text, picture.caption)
  const file = new File([blob], picture.fileName, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: picture.title })
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') throw e
    }
    return
  }
  download(blob, picture.fileName)
}
