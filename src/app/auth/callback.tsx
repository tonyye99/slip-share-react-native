import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'

import { LinkStatus } from '@/components/link-status'
import { completeAuthRedirect, type AuthRedirectParams } from '@/lib/auth-links'

// slipshare://auth/callback: where email confirmation links (and, on Android,
// OAuth redirects) land. Signs in with the link's code, then goes home.
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<Record<keyof AuthRedirectParams, string>>()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    completeAuthRedirect(params)
      .then(() => router.replace('/'))
      .catch((e) => {
        console.error('Auth redirect failed', e)
        setError(e instanceof Error ? e.message : 'Sign-in failed.')
      })
    // The params are fixed for the life of this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <LinkStatus
      error={error}
      progressMessage="Signing you in…"
      errorActionTitle="Back to sign in"
      onErrorAction={() => router.replace('/sign-in')}
    />
  )
}
