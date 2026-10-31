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

// ============ website only ============

function drawCode(context: CanvasRenderingContext2D, modules: boolean[][], left: number, top: number, cell: number) {
  context.fillStyle = '#000000'
  modules.forEach((dark, row) =>
    dark.forEach((on, col) => {
      if (on) context.fillRect(left + (col + QUIET_ZONE) * cell, top + (row + QUIET_ZONE) * cell, cell, cell)
    }),
  )
}

/**
 * The code as a PNG, `cell` points per square, sharp on high-density
 * screens. The website shows it as a picture so a long press can save it.
 */
export function qrImageUrl(modules: boolean[][], cell: number): string {
  const scale = Math.max(1, Math.ceil(window.devicePixelRatio || 1))
  const side = (modules.length + QUIET_ZONE * 2) * cell * scale
  const canvas = document.createElement('canvas')
  canvas.width = side
  canvas.height = side
  const context = canvas.getContext('2d')
  if (!context) return ''
  context.fillStyle = '#FFFFFF'
  context.fillRect(0, 0, side, side)
  drawCode(context, modules, 0, 0, cell * scale)
  return canvas.toDataURL('image/png')
}

/**
 * iPhone and iPad, including iPads that say they're a Mac. Their browsers
 * can only put a picture in Photos through the share sheet (Save Image) or
 * a long press on it, never with a plain download.
 */
export function isApplePhone(): boolean {
  if (typeof navigator === 'undefined') return false
  const agent = navigator.userAgent
  return /iPhone|iPad|iPod/.test(agent) || (agent.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

/**
 * Saves a QR code as a picture with a line or two under it, so a friend can
 * open it from their banking app's "scan from photos".
 * - `saved`: downloaded. On Android it lands in Downloads, which the gallery shows.
 * - `shared`: the iPhone share sheet opened; Save Image puts it in Photos.
 * - `hold`: an iPhone browser with no share sheet, like some in-app browsers.
 *   The QR on screen can still be saved with a long press.
 */
export async function saveQrImage(
  text: string,
  caption: string[],
  fileName: string,
): Promise<'saved' | 'shared' | 'hold'> {
  const blob = await qrPicture(text, caption)

  if (isApplePhone()) {
    const file = new File([blob], fileName, { type: 'image/png' })
    if (!navigator.canShare?.({ files: [file] })) return 'hold'
    try {
      await navigator.share({ files: [file] })
    } catch (e) {
      // Safari turns the share sheet down if drawing the picture took too
      // long after the tap. The QR on screen can still be saved with a long press.
      if ((e as Error)?.name === 'NotAllowedError') return 'hold'
      if ((e as Error)?.name !== 'AbortError') throw e
    }
    return 'shared'
  }

  // Android and computers: straight to Downloads, no pop-up.
  download(blob, fileName)
  return 'saved'
}

/** Starts a download of the picture. */
export function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** The code as a PNG with a line or two of text under it. */
export async function qrPicture(text: string, caption: string[]): Promise<Blob> {
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
  drawCode(context, modules, pad, pad, cell)
  context.fillStyle = '#10181B'
  context.textAlign = 'center'
  caption.forEach((line, index) => {
    context.font = `${index === 0 ? '700 24px' : '400 19px'} system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Thai", sans-serif`
    context.fillText(line, canvas.width / 2, pad + code + lineHeight * index + 14, canvas.width - pad * 2)
  })

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not make the picture')
  return blob
}
