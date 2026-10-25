/// <reference types="node" />

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { maskPath, screenName } from './analytics-events.ts'

test('screen names are route patterns without groups', () => {
  assert.equal(screenName([]), '/')
  assert.equal(screenName(['(app)']), '/')
  assert.equal(screenName(['(app)', 'receipts', '[id]']), '/receipts/[id]')
  assert.equal(screenName(['pick', '[token]']), '/pick/[token]')
})

test('friend link tokens and receipt ids are hidden in URLs', () => {
  assert.equal(maskPath('https://slipshare.expo.app/pick/3f2a-9c1e?x=1'), 'https://slipshare.expo.app/pick/[token]?x=1')
  assert.equal(maskPath('/receipts/abc123'), '/receipts/[id]')
  assert.equal(maskPath('https://slipshare.expo.app/account'), 'https://slipshare.expo.app/account')
})
