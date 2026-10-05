import type { ParsedReceipt } from '@/lib/types'

// Holds the parsed receipt between the scan and review screens; it is too
// large to pass as a route param and is discarded once saved.
let draft: ParsedReceipt | null = null

export const receiptDraft = {
  get: () => draft,
  set: (value: ParsedReceipt) => {
    draft = value
  },
  clear: () => {
    draft = null
  },
}
