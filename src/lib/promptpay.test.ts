/// <reference types="node" />

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  crc16,
  formatPromptPay,
  normalizePromptPay,
  promptPayKind,
  promptPayPayload,
  validPromptPay,
  validThaiId,
} from './promptpay.ts'

test('the checksum is CRC-16/CCITT-FALSE', () => {
  assert.equal(crc16('123456789'), '29B1')
})

// Same as the promptpay-qr package, which Thai banking apps have scanned for years.
test('a phone number with an amount', () => {
  assert.equal(
    promptPayPayload('0812345678', 117.7),
    '00020101021229370016A000000677010111011300668123456785802TH53037645406117.7063045FF0',
  )
})

test('without an amount the code can be used again', () => {
  assert.equal(
    promptPayPayload('0812345678'),
    '00020101021129370016A000000677010111011300668123456785802TH530376463045D82',
  )
  assert.equal(promptPayPayload('0812345678', 0), promptPayPayload('0812345678'))
})

test('a national ID and an e-wallet ID', () => {
  assert.equal(
    promptPayPayload('1234567890121', 999.18),
    '00020101021229370016A000000677010111021312345678901215802TH53037645406999.1863046457',
  )
  assert.equal(
    promptPayPayload('123456789012345', 50),
    '00020101021229390016A00000067701011103151234567890123455802TH5303764540550.006304B13C',
  )
})

test('amounts round to satang', () => {
  assert.match(promptPayPayload('0812345678', 12345.678), /540812345\.68/)
})

test('numbers people type are cleaned up', () => {
  assert.equal(normalizePromptPay('081-234-5678'), '0812345678')
  assert.equal(normalizePromptPay(' +66 81 234 5678 '), '0812345678')
  assert.equal(normalizePromptPay('1 2345 67890 12 1'), '1234567890121')
})

test('what kind of number it is', () => {
  assert.equal(promptPayKind('0812345678'), 'phone')
  assert.equal(promptPayKind('8123456789'), null)
  assert.equal(promptPayKind('1234567890121'), 'id')
  assert.equal(promptPayKind('123456789012345'), 'ewallet')
  assert.equal(promptPayKind('12345'), null)
  assert.throws(() => promptPayPayload('12345'))
})

test('a national ID with a typo is turned away', () => {
  assert.ok(validThaiId('1234567890121'))
  assert.ok(!validThaiId('1234567890122'))
  assert.ok(validPromptPay('1234567890121'))
  assert.ok(!validPromptPay('1234567890122'))
  assert.ok(validPromptPay('0812345678'))
  assert.ok(!validPromptPay('081234567'))
})

test('numbers are shown the way Thai banks show them', () => {
  assert.equal(formatPromptPay('0812345678'), '081-234-5678')
  assert.equal(formatPromptPay('1234567890121'), '1-2345-67890-12-1')
  assert.equal(formatPromptPay('123456789012345'), '123456789012345')
})
