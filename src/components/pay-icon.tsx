import type { ReactNode } from 'react'

import { BankIcon, NoteIcon, QrIcon } from '@/components/icons'
import type { PayMethodKind } from '@/lib/pay-lines'

export function payIcon(kind: PayMethodKind, color: string, size = 18): ReactNode {
  if (kind === 'promptpay') return <QrIcon color={color} size={size} />
  if (kind === 'bank') return <BankIcon color={color} size={size} />
  return <NoteIcon color={color} size={size} />
}
