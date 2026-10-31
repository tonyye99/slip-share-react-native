/// <reference types="node" />

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { applyLanguage } from '../i18n/strings.ts'
import {
  cleanBankAccount,
  cleanText,
  groupPayQr,
  payLines,
  paySubtitle,
  payTitle,
  withPayMe,
  type PayDetails,
} from './pay-lines.ts'
import { crc16, promptPayPayload } from './promptpay.ts'

const promptpay: PayDetails = { kind: 'promptpay', value: '0812345678', bank: null, name: 'Ye H.' }
const bank: PayDetails = { kind: 'bank', value: '123-4-56789-0', bank: 'Kasikorn Bank', name: 'Ye H.' }
const note: PayDetails = { kind: 'note', value: 'Cash is fine', bank: null, name: null }

test('each way to pay gets a title and a line under it', () => {
  applyLanguage('en')
  assert.equal(payTitle(promptpay), 'PromptPay')
  assert.equal(paySubtitle(promptpay), '081-234-5678 · Ye H.')
  assert.equal(payTitle(bank), 'Kasikorn Bank')
  assert.equal(paySubtitle(bank), '123-4-56789-0 · Ye H.')
  assert.equal(payTitle(note), 'Note')
  assert.equal(paySubtitle(note), 'Cash is fine')
  assert.equal(paySubtitle({ ...promptpay, name: null }), '081-234-5678')
})

test('Send totals ends with how to pay you', () => {
  applyLanguage('en')
  assert.deepEqual(payLines([promptpay, bank, note]), [
    'PromptPay 081-234-5678 (Ye H.)',
    'Kasikorn Bank 123-4-56789-0 (Ye H.)',
    'Cash is fine',
  ])
  assert.equal(
    withPayMe('Dinner: ฿999.18', [promptpay, bank]),
    ['Dinner: ฿999.18', '', 'Pay me', 'PromptPay 081-234-5678 (Ye H.)', 'Kasikorn Bank 123-4-56789-0 (Ye H.)'].join(
      '\n',
    ),
  )
})

test('a note, or nothing to add', () => {
  applyLanguage('en')
  assert.equal(withPayMe('x', [note]), 'x\n\nPay me\nCash is fine')
  assert.equal(withPayMe('x', []), 'x')
})

test('in Thai', () => {
  applyLanguage('th')
  assert.equal(withPayMe('x', [promptpay]), 'x\n\nโอนให้ฉันได้ที่\nพร้อมเพย์ 081-234-5678 (Ye H.)')
  applyLanguage('en')
})

test('bank account numbers follow the same rule as the database', () => {
  assert.equal(cleanBankAccount(' 123-4-56789-0 '), '123-4-56789-0')
  assert.equal(cleanBankAccount('123  456   7890'), '123 456 7890')
  assert.equal(cleanBankAccount('GB33BUKB20201555555555'), 'GB33BUKB20201555555555')
  assert.equal(cleanBankAccount('12'), null)
  assert.equal(cleanBankAccount('-1234'), null)
  assert.equal(cleanBankAccount('1234/5678'), null)
  assert.equal(cleanText('  Ye   H. '), 'Ye H.')
  assert.equal(cleanText('   '), null)
})

test("a bank's QR shows its number, or says it's a QR", () => {
  applyLanguage('en')
  const fromBank: PayDetails = { kind: 'promptpay', value: promptPayPayload('0812345678'), bank: null, name: 'Ye H.' }
  assert.equal(paySubtitle(fromBank), '081-234-5678 · Ye H.')
  assert.deepEqual(payLines([fromBank]), ['PromptPay 081-234-5678 (Ye H.)'])
  const shopBody =
    '00020101021130710016A00000067701011201150107536000315080214KB0000012345670310SHOP12345653037645802TH5908KAI SHOP6304'
  const shop: PayDetails = { kind: 'promptpay', value: shopBody + crc16(shopBody), bank: null, name: 'Ye H.' }
  assert.equal(paySubtitle(shop), "Your bank's QR · Ye H.")
  assert.deepEqual(payLines([shop]), ['PromptPay QR (Ye H.)'])
})

test('the QR for the group has no amount, from your first PromptPay', () => {
  const qr = groupPayQr([bank, promptpay], 'thb')
  assert.equal(qr?.payload, promptPayPayload('0812345678'))
  assert.equal(qr?.id, '0812345678')
  assert.equal(qr?.name, 'Ye H.')
  assert.ok(!qr?.payload.includes('5406'))
  assert.equal(groupPayQr([promptpay], 'USD'), null)
  assert.equal(groupPayQr([bank, note], 'THB'), null)
})
