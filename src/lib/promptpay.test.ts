/// <reference types="node" />

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  crc16,
  emvFields,
  formatPromptPay,
  isBankQr,
  normalizePromptPay,
  payPayload,
  promptPayId,
  promptPayKind,
  promptPayPayload,
  readBankQr,
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

// A "My QR" like a banking app saves: a reusable code with the bank's name and a reference.
const withCrc = (body: string) => body + crc16(body)
const bankStatic = withCrc(
  '000201010211' +
    '29370016A000000677010111011300668123456785802TH5303764' +
    '5910YE HTET A.6007BANGKOK' +
    '62070703K01' +
    '6304',
)

test('a bank QR is read, with its number and name', () => {
  const qr = readBankQr(bankStatic)
  assert.ok(qr)
  assert.equal(qr.id, '0812345678')
  assert.equal(qr.name, 'YE HTET A.')
  assert.equal(qr.payload, bankStatic)
})

test("friends' amounts go into the bank's own QR", () => {
  const paid = payPayload(bankStatic, 117.7)
  const fields = emvFields(paid)!
  assert.equal(fields.find((one) => one.id === '01')?.value, '12')
  assert.equal(fields.find((one) => one.id === '54')?.value, '117.70')
  assert.equal(fields.find((one) => one.id === '59')?.value, 'YE HTET A.')
  assert.equal(fields.find((one) => one.id === '62')?.value, '0703K01')
  assert.equal(paid.slice(-4), crc16(paid.slice(0, -4)))
  // The fields come out in the same order as our own codes.
  assert.ok(paid.indexOf('5303764') < paid.indexOf('5406117.70') && paid.indexOf('5406117.70') < paid.indexOf('5910'))
})

test('our own code read back as a bank QR gives the same result', () => {
  const qr = readBankQr(promptPayPayload('0812345678'))!
  assert.equal(payPayload(qr.payload, 117.7), promptPayPayload('0812345678', 117.7))
  assert.equal(payPayload('0812345678', 117.7), promptPayPayload('0812345678', 117.7))
})

test('a QR that already has an amount is saved without it', () => {
  const qr = readBankQr(promptPayPayload('1234567890121', 50))!
  assert.equal(qr.payload, promptPayPayload('1234567890121'))
  assert.equal(qr.id, '1234567890121')
})

test('a shop QR (bill payment) works but has no number to show', () => {
  const shop = withCrc('00020101021130710016A00000067701011201150107536000315080214KB0000012345670310SHOP12345653037645802TH5908KAI SHOP6304')
  const qr = readBankQr(shop)
  assert.ok(qr)
  assert.equal(qr.id, null)
  assert.equal(promptPayId(qr.payload), null)
  assert.match(payPayload(qr.payload, 20), /540520\.00/)
})

test('anything else is turned away', () => {
  assert.equal(readBankQr('https://example.com'), null)
  assert.equal(readBankQr(bankStatic.slice(0, -1) + (bankStatic.endsWith('0') ? '1' : '0')), null, 'wrong checksum')
  assert.equal(readBankQr(withCrc('00020101021129370016A000000677010111011300668123456785802SG53037025802SG6304')), null, 'not baht')
  assert.equal(readBankQr(withCrc('000201010211263800160000000000000000011409876543215802TH53037646304')), null, 'not PromptPay')
  assert.equal(readBankQr('00020101021129'), null, 'cut off')
})

test('the number to show comes from the QR or the saved number', () => {
  assert.equal(promptPayId('0812345678'), '0812345678')
  assert.equal(promptPayId(bankStatic), '0812345678')
  assert.ok(isBankQr(bankStatic) && !isBankQr('0812345678'))
})
