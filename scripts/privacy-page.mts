import { readFileSync, writeFileSync } from 'node:fs'

import { privacyHtml } from '../src/lib/privacy-html.ts'

writeFileSync('public/privacy.html', privacyHtml(readFileSync('PRIVACY.md', 'utf8')))
console.log('Wrote public/privacy.html')
