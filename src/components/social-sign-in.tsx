import * as AppleAuthentication from 'expo-apple-authentication'
import { useEffect, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'

import { AppText, Button } from '@/components/ui'
import { Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useTheme } from '@/hooks/use-theme'
import { signInWithApple, signInWithProvider } from '@/lib/auth-links'

type Provider = 'apple' | 'google' | 'github'

/** "Continue with Apple / Google / GitHub". The session change moves the app on. */
export function SocialSignIn({ onError }: { onError: (message: string | null) => void }) {
  const theme = useTheme()
  const dark = useColorScheme() === 'dark'
  const [appleAvailable, setAppleAvailable] = useState(false)
  const [busy, setBusy] = useState<Provider | null>(null)

  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setAppleAvailable)
  }, [])

  const run = async (provider: Provider) => {
    setBusy(provider)
    onError(null)
    try {
      if (provider === 'apple') await signInWithApple()
      else await signInWithProvider(provider)
    } catch (e) {
      console.error(`${provider} sign-in failed`, e)
      onError(e instanceof Error ? e.message : 'Sign-in failed. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: theme.border }]} />
        <AppText variant="muted">or</AppText>
        <View style={[styles.line, { backgroundColor: theme.border }]} />
      </View>
      {appleAvailable && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={
            dark
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={12}
          style={styles.apple}
          onPress={() => run('apple')}
        />
      )}
      <Button
        title="Continue with Google"
        variant="secondary"
        onPress={() => run('google')}
        loading={busy === 'google'}
        disabled={busy !== null}
      />
      <Button
        title="Continue with GitHub"
        variant="secondary"
        onPress={() => run('github')}
        loading={busy === 'github'}
        disabled={busy !== null}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginVertical: Spacing.two },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  apple: { height: 50 },
})
