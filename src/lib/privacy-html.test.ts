/// <reference types="node" />

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { privacyHtml } from './privacy-html.ts'

test('the website privacy page matches PRIVACY.md', () => {
  const page = readFileSync('public/privacy.html', 'utf8')
  assert.equal(page, privacyHtml(readFileSync('PRIVACY.md', 'utf8')), 'Run npm run privacy:page after editing PRIVACY.md')
})

test('lists, bold, links and emails turn into HTML', () => {
  const html = privacyHtml('# Title\n\nSee **Account** at [site](https://x.y).\n\n- one\n  - sub\n- two\n\n1. first\n2. second\n\nMail <a@b.co>.')
  assert.match(html, /<h1>Title<\/h1>/)
  assert.match(html, /<p>See <strong>Account<\/strong> at <a href="https:\/\/x.y">site<\/a>.<\/p>/)
  assert.match(html, /<ul><li>one<ul><li>sub<\/li><\/ul><\/li><li>two<\/li><\/ul>/)
  assert.match(html, /<ol><li>first<\/li><li>second<\/li><\/ol>/)
  assert.match(html, /<a href="mailto:a@b.co">a@b.co<\/a>/)
})
