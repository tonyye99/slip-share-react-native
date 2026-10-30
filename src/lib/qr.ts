import makeQr from 'qrcode-generator'

/** Which squares of a QR code are dark, row by row. Error correction M copes with a smudge or a crease. */
export function qrModules(text: string): boolean[][] {
  const qr = makeQr(0, 'M')
  qr.addData(text)
  qr.make()
  const count = qr.getModuleCount()
  return Array.from({ length: count }, (_, row) => Array.from({ length: count }, (_, col) => qr.isDark(row, col)))
}

/** The white border round a QR code, in squares. Banking apps read codes best with all four. */
export const QUIET_ZONE = 4

/**
 * Website only: saves a QR code as a picture with a line or two under it, so
 * a friend on their phone can open it from their banking app's "scan from
 * photos". Phones get the share sheet (Save Image); computers download it.
 */
export async function saveQrImage(text: string, caption: string[], fileName: string): Promise<void> {
  const modules = qrModules(text)
  const cell = 10
  const code = (modules.length + QUIET_ZONE * 2) * cell
  const pad = 24
  const lineHeight = 32
  const canvas = document.createElement('canvas')
  canvas.width = code + pad * 2
  canvas.height = code + pad * 2 + caption.length * lineHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No canvas')
  context.fillStyle = '#FFFFFF'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#000000'
  modules.forEach((dark, row) =>
    dark.forEach((on, col) => {
      if (on) context.fillRect(pad + (col + QUIET_ZONE) * cell, pad + (row + QUIET_ZONE) * cell, cell, cell)
    }),
  )
  context.fillStyle = '#10181B'
  context.textAlign = 'center'
  caption.forEach((line, index) => {
    context.font = `${index === 0 ? '700 24px' : '400 19px'} system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Thai", sans-serif`
    context.fillText(line, canvas.width / 2, pad + code + lineHeight * index + 14, canvas.width - pad * 2)
  })

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not make the picture')
  const file = new File([blob], fileName, { type: 'image/png' })
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') throw e
    }
    return
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
