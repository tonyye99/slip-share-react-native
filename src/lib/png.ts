// A black-and-white PNG of a QR code, made in plain JavaScript so the phone
// app can share one without a canvas. One bit per pixel and no compression
// keeps it short; a QR picture is still only a few kilobytes.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function adler32(bytes: Uint8Array): number {
  let a = 1
  let b = 0
  for (const byte of bytes) {
    a = (a + byte) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

const u32 = (value: number) => [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]

function chunk(type: string, data: Uint8Array): number[] {
  const typed = new Uint8Array(4 + data.length)
  for (let i = 0; i < 4; i++) typed[i] = type.charCodeAt(i)
  typed.set(data, 4)
  return [...u32(data.length), ...typed, ...u32(crc32(typed))]
}

/** zlib data with the bytes stored as they are, in blocks of up to 65535. */
function stored(raw: Uint8Array): Uint8Array {
  const blocks = Math.max(1, Math.ceil(raw.length / 65535))
  const out = new Uint8Array(2 + raw.length + blocks * 5 + 4)
  out[0] = 0x78
  out[1] = 0x01
  let at = 2
  for (let i = 0; i < blocks; i++) {
    const part = raw.subarray(i * 65535, Math.min(raw.length, (i + 1) * 65535))
    out[at++] = i === blocks - 1 ? 1 : 0
    out[at++] = part.length & 0xff
    out[at++] = part.length >>> 8
    out[at++] = ~part.length & 0xff
    out[at++] = (~part.length >>> 8) & 0xff
    out.set(part, at)
    at += part.length
  }
  out.set(u32(adler32(raw)), at)
  return out
}

/**
 * The QR code as PNG bytes: `cell` pixels per square and a white `border`
 * of squares all round (banking apps read codes best with four).
 */
export function qrPng(modules: boolean[][], cell: number, border = 4): Uint8Array {
  const count = modules.length
  const side = (count + border * 2) * cell
  const rowBytes = Math.ceil(side / 8)
  const raw = new Uint8Array((rowBytes + 1) * side).fill(0xff)
  for (let y = 0; y < side; y++) {
    const start = y * (rowBytes + 1)
    raw[start] = 0 // no filter
    const row = Math.floor(y / cell) - border
    if (row < 0 || row >= count) continue
    for (let x = 0; x < side; x++) {
      const col = Math.floor(x / cell) - border
      // In a 1-bit grey PNG, 0 is black.
      if (col >= 0 && col < count && modules[row][col]) raw[start + 1 + (x >> 3)] &= ~(0x80 >> (x & 7))
    }
  }
  const header = new Uint8Array([...u32(side), ...u32(side), 1, 0, 0, 0, 0]) // 1 bit, grey
  return new Uint8Array([
    ...SIGNATURE,
    ...chunk('IHDR', header),
    ...chunk('IDAT', stored(raw)),
    ...chunk('IEND', new Uint8Array(0)),
  ])
}
