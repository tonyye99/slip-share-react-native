/// <reference types="node" />

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { applyLanguage } from '../i18n/strings.ts'
import { cleanBankAccount, cleanText, payLines, paySubtitle, payTitle, withPayMe, type PayDetails } from './pay-lines.ts'

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

test('Send totals ends with how to pay you and the link', () => {
  applyLanguage('en')
  assert.deepEqual(payLines([promptpay, bank, note]), [
    'PromptPay 081-234-5678 (Ye H.)',
    'Kasikorn Bank 123-4-56789-0 (Ye H.)',
    'Cash is fine',
  ])
  assert.equal(
    withPayMe('Dinner: ฿999.18', [promptpay, bank], 'https://slip-share.expo.app/pick/abc'),
    [
      'Dinner: ฿999.18',
      '',
      'Pay me',
      'PromptPay 081-234-5678 (Ye H.)',
      'Kasikorn Bank 123-4-56789-0 (Ye H.)',
      '',
      'Tick what you had and get your pay QR: https://slip-share.expo.app/pick/abc',
    ].join('\n'),
  )
})

test('no QR, no link, or nothing to add', () => {
  applyLanguage('en')
  assert.match(withPayMe('x', [bank], 'https://a/pick/b'), /see how to pay: https:\/\/a\/pick\/b$/)
  assert.equal(withPayMe('x', [note]), 'x\n\nPay me\nCash is fine')
  assert.equal(withPayMe('x', [], 'https://a/pick/b'), 'x')
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
