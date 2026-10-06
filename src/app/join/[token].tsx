import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'

import { LinkStatus } from '@/components/link-status'
import { useAuth } from '@/lib/auth'
import { joinReceipt } from '@/lib/receipts'
import { isShareToken, pendingJoin } from '@/lib/share'

// Opened from a share link (slipshare://join/<token>). Outside the signed-in
// group so it works when signed out: the token is kept and resumed after sign-in.
export default function JoinScreen() {
  const { token } = useLocalSearchParams<{ token: string }>()
  const { session } = useAuth()
  const valid = isShareToken(token)
  const [joinError, setJoinError] = useState<string | null>(null)
  const error = valid ? joinError : "This link isn't valid. Ask for a new one."

  useEffect(() => {
    if (!valid) return
    if (!session) {
      pendingJoin.set(token)
      router.replace('/sign-in')
      return
    }
    joinReceipt(token)
      .then((receiptId) => router.replace(`/receipts/${receiptId}`))
      .catch((e) => {
        console.error('Join failed', e)
        setJoinError("Couldn't open this bill. The link may be wrong or the receipt was deleted.")
      })
  }, [token, valid, session])

  return (
    <LinkStatus
      error={error}
      progressMessage="Opening the bill…"
      errorActionTitle="Go to my receipts"
      onErrorAction={() => router.replace('/')}
    />
  )
}
