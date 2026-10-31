import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { decode } from 'jpeg-js'
import jsQR from 'jsqr'

// Reads the QR code in a photo, like the one a banking app saves from My QR.
// The phone app has no canvas, so the photo is shrunk to a JPEG and its
// pixels are unpacked in JavaScript. The website has its own version.

function bytesOf(base64: string): Uint8Array {
  const text = atob(base64)
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i)
  return bytes
}

/** The text in the QR code in the photo, or null if none can be read. */
export async function readQrFromPhoto(photo: { uri: string; width: number }): Promise<string | null> {
  // A smaller picture reads faster; a bigger one helps a QR that fills little of it.
  for (const size of [900, 1600]) {
    const context = ImageManipulator.manipulate(photo.uri)
    if (photo.width > size) context.resize({ width: size })
    const image = await context.renderAsync()
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.95, base64: true })
    if (!saved.base64) continue
    const pixels = decode(bytesOf(saved.base64), { useTArray: true, formatAsRGBA: true })
    const rgba = new Uint8ClampedArray(pixels.data.buffer, pixels.data.byteOffset, pixels.data.length)
    const code = jsQR(rgba, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' })
    if (code?.data) return code.data
    if (photo.width <= size) break
  }
  return null
}
