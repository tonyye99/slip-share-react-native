import assert from 'node:assert/strict'
import { test } from 'node:test'
import { crc32, inflateSync } from 'node:zlib'

import { qrPng } from './png.ts'

/** Reads back a PNG made by qrPng: its size and which pixels are black. */
function readPng(bytes: Uint8Array) {
  const data = Buffer.from(bytes)
  assert.deepEqual([...data.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  let at = 8
  const chunks: Record<string, Buffer> = {}
  while (at < data.length) {
    const length = data.readUInt32BE(at)
    const type = data.subarray(at + 4, at + 8).toString('ascii')
    const body = data.subarray(at + 8, at + 8 + length)
    assert.equal(data.readUInt32BE(at + 8 + length), crc32(data.subarray(at + 4, at + 8 + length)), `${type} CRC`)
    chunks[type] = body
    at += 12 + length
  }
  const width = chunks.IHDR.readUInt32BE(0)
  const height = chunks.IHDR.readUInt32BE(4)
  assert.deepEqual([...chunks.IHDR.subarray(8)], [1, 0, 0, 0, 0])
  assert.ok(chunks.IEND)
  const raw = inflateSync(chunks.IDAT)
  const rowBytes = Math.ceil(width / 8)
  assert.equal(raw.length, (rowBytes + 1) * height)
  const black = (x: number, y: number) => ((raw[y * (rowBytes + 1) + 1 + (x >> 3)] >> (7 - (x & 7))) & 1) === 0
  return { width, height, black }
}

test('a small code: size, border and squares', () => {
  const modules = [
    [true, false, true],
    [false, true, false],
    [true, true, false],
  ]
  const png = readPng(qrPng(modules, 2, 1))
  assert.equal(png.width, 10)
  assert.equal(png.height, 10)
  // border stays white
  for (let i = 0; i < 10; i++) {
    assert.equal(png.black(i, 0), false)
    assert.equal(png.black(0, i), false)
  }
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++)
      for (const [dx, dy] of [
        [0, 0],
        [1, 1],
      ]) {
        assert.equal(png.black(2 + col * 2 + dx, 2 + row * 2 + dy), modules[row][col], `${row},${col}`)
      }
})

test('a code bigger than one stored block still reads back', () => {
  const count = 57
  const modules = Array.from({ length: count }, (_, row) =>
    Array.from({ length: count }, (_, col) => (row * 7 + col * 3) % 5 === 0),
  )
  const png = readPng(qrPng(modules, 12))
  assert.equal(png.width, (count + 8) * 12)
  assert.equal(png.black(4 * 12 + 5, 4 * 12 + 5), modules[0][0])
  assert.equal(png.black((4 + 56) * 12 + 1, (4 + 56) * 12 + 1), modules[56][56])
  assert.equal(png.black(1, 1), false)
})
