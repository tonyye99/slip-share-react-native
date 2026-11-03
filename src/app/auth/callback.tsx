import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'

import { LinkStatus } from '@/components/link-status'
import { useT } from '@/i18n'
import { completeAuthRedirect, type AuthRedirectParams } from '@/lib/auth-links'

export default function AuthCallbackScreen() {
  const t = useT()
  const params = useLocalSearchParams<Record<keyof AuthRedirectParams, string>>()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    completeAuthRedirect(params)
      .then(() => router.replace('/'))
      .catch((e) => {
        console.error('Auth redirect failed', e)
        setError(e instanceof Error ? t.auth.errorText(e.message) : t.auth.signInFailedShort)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <LinkStatus
      error={error}
      progressMessage={t.auth.signingIn}
      errorActionTitle={t.auth.backToSignIn}
      onErrorAction={() => router.replace('/sign-in')}
    />
  )
}
