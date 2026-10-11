import * as AppleAuthentication from 'expo-apple-authentication'
import { useEffect, useState } from 'react'
import { Platform, StyleSheet, useColorScheme, View } from 'react-native'

import { Button, Divider } from '@/components/ui'
import { Spacing } from '@/constants/theme'
import { signInWithApple, signInWithProvider } from '@/lib/auth-links'

type Provider = 'apple' | 'google' | 'github'

/** "Continue with Apple / Google / GitHub". The session change moves the app on. */
export function SocialSignIn({ onError }: { onError: (message: string | null) => void }) {
  const isDark = useColorScheme() === 'dark'
  const [appleAvailable, setAppleAvailable] = useState(false)
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null)

  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setAppleAvailable)
  }, [])

  const signIn = async (provider: Provider) => {
    setPendingProvider(provider)
    onError(null)
    try {
      if (provider === 'apple') await signInWithApple()
      else await signInWithProvider(provider)
    } catch (e) {
      console.error(`${provider} sign-in failed`, e)
      onError(e instanceof Error ? e.message : 'Sign-in failed. Please try again.')
    } finally {
      setPendingProvider(null)
    }
  }

  return (
    <View style={styles.container}>
      <Divider label="or" />
      {appleAvailable && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={
            isDark
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={12}
          style={styles.apple}
          onPress={() => signIn('apple')}
        />
      )}
      <Button
        title="Continue with Google"
        variant="secondary"
        onPress={() => signIn('google')}
        loading={pendingProvider === 'google'}
        disabled={pendingProvider !== null}
      />
      <Button
        title="Continue with GitHub"
        variant="secondary"
        onPress={() => signIn('github')}
        loading={pendingProvider === 'github'}
        disabled={pendingProvider !== null}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  apple: { height: 50 },
})
