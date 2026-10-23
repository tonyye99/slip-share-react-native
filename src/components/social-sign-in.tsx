import * as AppleAuthentication from 'expo-apple-authentication'
import { Image, type ImageSource } from 'expo-image'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, useColorScheme, View } from 'react-native'

import { AppText, Divider } from '@/components/ui'
import { useTheme } from '@/hooks/use-theme'
import { signInWithApple, signInWithProvider } from '@/lib/auth-links'

type Provider = 'apple' | 'google' | 'github'

/** "or continue with" Google and GitHub side by side, and Apple under them on iPhone. The session change moves the app on. */
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
      <Divider label="or continue with" style={styles.divider} />
      <View style={styles.row}>
        <ProviderButton
          title="Google"
          icon={require('@/assets/images/google.png')}
          onPress={() => signIn('google')}
          pending={pendingProvider === 'google'}
          disabled={pendingProvider !== null}
        />
        <ProviderButton
          title="GitHub"
          icon={require('@/assets/images/github.png')}
          // The GitHub mark is black, so it takes the text colour to show up in dark mode.
          tinted
          onPress={() => signIn('github')}
          pending={pendingProvider === 'github'}
          disabled={pendingProvider !== null}
        />
      </View>
      {appleAvailable && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={
            isDark
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE
          }
          cornerRadius={14}
          style={styles.apple}
          onPress={() => signIn('apple')}
        />
      )}
    </View>
  )
}

function ProviderButton({
  title,
  icon,
  tinted,
  onPress,
  pending,
  disabled,
}: {
  title: string
  icon: ImageSource
  tinted?: boolean
  onPress: () => void
  pending: boolean
  disabled: boolean
}) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Continue with ${title}`}
      accessibilityState={{ disabled, busy: pending }}
      style={({ pressed }) => [
        styles.provider,
        { borderColor: theme.hairline, backgroundColor: pressed ? theme.background : theme.surface },
        disabled && !pending && styles.dimmed,
      ]}>
      {pending ? (
        <ActivityIndicator color={theme.text} />
      ) : (
        <>
          <Image source={icon} style={styles.icon} tintColor={tinted ? theme.text : undefined} />
          <AppText style={[styles.providerText, { color: theme.text }]}>{title}</AppText>
        </>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: { gap: 14, marginTop: 1 },
  divider: { marginVertical: 0 },
  row: { flexDirection: 'row', gap: 10 },
  provider: {
    flex: 1,
    height: 49,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  dimmed: { opacity: 0.5 },
  icon: { width: 20, height: 20 },
  providerText: { fontSize: 16, lineHeight: 21, fontWeight: '600' },
  apple: { height: 49 },
})
