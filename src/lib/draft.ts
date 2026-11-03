import type { ParsedReceipt } from '@/lib/types'

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
