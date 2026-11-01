/// <reference types="node" />

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { bothNames, realName } from './names.ts'

test('placeholder names from a scan count as no name', () => {
  for (const name of ['Unknown', 'unknown ', 'N/A', 'NA', 'none', '-', '?', 'ไม่ทราบ', '', '  ', null, undefined]) {
    assert.equal(realName(name), null, String(name))
  }
  assert.equal(realName(' Som Tam Nua '), 'Som Tam Nua')
  assert.equal(realName('Unknown Pleasures Cafe'), 'Unknown Pleasures Cafe')
})

test('an Unknown printed name falls back to the English one, or to nothing', () => {
  assert.equal(bothNames('Unknown', 'Thai Kitchen', false).main, 'Thai Kitchen')
  assert.equal(bothNames('Unknown', 'Unknown', true).main, '')
  assert.deepEqual(bothNames('ครัวบ้านสวน', 'Khrua Baan Suan', true), { main: 'Khrua Baan Suan', other: 'ครัวบ้านสวน' })
})

test('receipt marks like *** and >* are dropped from names', () => {
  assert.equal(realName('***14.Fried Mandu'), '14.Fried Mandu')
  assert.equal(realName('* ***45. Egg Kim Bab'), '45. Egg Kim Bab')
  assert.equal(realName('>*(Free) Pork Born Soup'), '(Free) Pork Born Soup')
  assert.equal(realName('***'), null)
})
