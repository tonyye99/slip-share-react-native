import makeQr from 'qrcode-generator'

export function qrModules(text: string): boolean[][] {
  const qr = makeQr(0, 'M')
  qr.addData(text)
  qr.make()
  const count = qr.getModuleCount()
  return Array.from({ length: count }, (_, row) => Array.from({ length: count }, (_, col) => qr.isDark(row, col)))
}

export const QUIET_ZONE = 4

function drawCode(context: CanvasRenderingContext2D, modules: boolean[][], left: number, top: number, cell: number) {
  context.fillStyle = '#000000'
  modules.forEach((dark, row) =>
    dark.forEach((on, col) => {
      if (on) context.fillRect(left + (col + QUIET_ZONE) * cell, top + (row + QUIET_ZONE) * cell, cell, cell)
    }),
  )
}

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

export function isApplePhone(): boolean {
  if (typeof navigator === 'undefined') return false
  const agent = navigator.userAgent
  return /iPhone|iPad|iPod/.test(agent) || (agent.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

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
      if ((e as Error)?.name === 'NotAllowedError') return 'hold'
      if ((e as Error)?.name !== 'AbortError') throw e
    }
    return 'shared'
  }

  download(blob, fileName)
  return 'saved'
}

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

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Thai", sans-serif'

function wrap(context: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const piece of paragraph.split(/(\s+)/)) {
      if (context.measureText(line + piece).width <= width) {
        line += piece
        continue
      }
      if (line.trim()) lines.push(line.trimEnd())
      line = piece.trimStart()
      while (context.measureText(line).width > width) {
        let cut = line.length - 1
        while (cut > 1 && context.measureText(line.slice(0, cut)).width > width) cut--
        lines.push(line.slice(0, cut))
        line = line.slice(cut)
      }
    }
    lines.push(line.trimEnd())
  }
  return lines
}

export async function totalsPicture(message: string, qr: string, caption: string[], note: string): Promise<Blob> {
  const width = 640
  const pad = 36
  const inner = width - pad * 2
  const messageFont = `400 24px ${FONT}`
  const messageLine = 34
  const noteFont = `400 18px ${FONT}`
  const noteLine = 26
  const modules = qrModules(qr)
  const cell = 9
  const code = (modules.length + QUIET_ZONE * 2) * cell

  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) throw new Error('No canvas')
  measure.font = messageFont
  const messageLines = wrap(measure, message, inner)
  measure.font = noteFont
  const noteLines = wrap(measure, note, inner)

  const ruleAt = pad + messageLines.length * messageLine + 16
  const codeAt = ruleAt + 24
  const captionAt = codeAt + code + 8
  const noteAt = captionAt + caption.length * 34 + 10
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = noteAt + noteLines.length * noteLine + pad - 8
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No canvas')
  context.fillStyle = '#FFFFFF'
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.fillStyle = '#10181B'
  context.textBaseline = 'top'
  context.font = messageFont
  messageLines.forEach((line, index) => context.fillText(line, pad, pad + index * messageLine))
  context.fillStyle = '#E3E8EA'
  context.fillRect(pad, ruleAt, inner, 2)

  drawCode(context, modules, (width - code) / 2, codeAt, cell)
  context.fillStyle = '#10181B'
  context.textAlign = 'center'
  caption.forEach((line, index) => {
    context.font = `${index === 0 ? '700 26px' : '400 21px'} ${FONT}`
    context.fillText(line, width / 2, captionAt + index * 34, inner)
  })
  context.fillStyle = '#5B6B70'
  context.font = noteFont
  noteLines.forEach((line, index) => context.fillText(line, width / 2, noteAt + index * noteLine))

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not make the picture')
  return blob
}
