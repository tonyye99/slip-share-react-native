import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { AppText, Button } from '@/components/ui'
import { Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { completeAuthRedirect, type AuthRedirectParams } from '@/lib/auth-links'

// slipshare://auth/callback: where email confirmation links (and, on Android,
// OAuth redirects) land. Signs in with the link's code, then goes home.
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<Record<keyof AuthRedirectParams, string>>()
  const theme = useTheme()
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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {error ? (
        <>
          <AppText variant="error" style={styles.center}>
            {error}
          </AppText>
          <Button title="Back to sign in" variant="secondary" onPress={() => router.replace('/sign-in')} />
        </>
      ) : (
        <>
          <ActivityIndicator />
          <AppText variant="muted">Signing you in…</AppText>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  center: { textAlign: 'center' },
})
