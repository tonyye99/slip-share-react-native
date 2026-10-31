import jsQR from 'jsqr'

// The website reads the QR code in a picture by drawing it on a canvas.

function load(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not open the picture'))
    image.src = uri
  })
}

/** The text in the QR code in the photo, or null if none can be read. */
export async function readQrFromPhoto(photo: { uri: string; width: number }): Promise<string | null> {
  const image = await load(photo.uri)
  const longest = Math.max(image.naturalWidth, image.naturalHeight)
  // A smaller picture reads faster; full size helps a QR that fills little of it.
  for (const size of [1000, longest]) {
    const scale = Math.min(1, size / longest)
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null
    context.fillStyle = '#FFFFFF'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    const pixels = context.getImageData(0, 0, width, height)
    const code = jsQR(pixels.data, width, height, { inversionAttempts: 'attemptBoth' })
    if (code?.data) return code.data
    if (scale === 1) break
  }
  return null
}
