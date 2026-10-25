// Writes public/privacy.html from PRIVACY.md. Run with `npm run privacy:page`
// after editing PRIVACY.md (deploy:web runs it too).
import { readFileSync, writeFileSync } from 'node:fs'

import { privacyHtml } from '../src/lib/privacy-html.ts'

writeFileSync('public/privacy.html', privacyHtml(readFileSync('PRIVACY.md', 'utf8')))
console.log('Wrote public/privacy.html')
