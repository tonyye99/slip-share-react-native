import { Link } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { SocialSignIn } from '@/components/social-sign-in'
import { AppText, Button, TextField } from '@/components/ui'
import { MaxContentWidth, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

interface AuthResult {
  error?: string
  notice?: string
}

interface AuthFormProps {
  mode: 'sign-in' | 'sign-up'
  onSubmit: (values: { name: string; email: string; password: string }) => Promise<AuthResult>
}

/** Centered, keyboard-aware page used by every signed-out screen. */
export function AuthLayout({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  const theme = useTheme()
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <AppText variant="title">SlipShare</AppText>
            <AppText variant="muted">{subtitle}</AppText>
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export const authStyles = StyleSheet.create({
  link: { alignSelf: 'center', paddingVertical: Spacing.two },
})

/** Shared email/password form for the sign-in and sign-up screens. */
export function AuthForm({ mode, onSubmit }: AuthFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const isSignUp = mode === 'sign-up'

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      setError('Enter your email and a password of at least 6 characters.')
      return
    }
    setSubmitting(true)
    setError(null)
    setNotice(null)
    const result = await onSubmit({ name: name.trim(), email: email.trim(), password })
    setSubmitting(false)
    setError(result.error ?? null)
    setNotice(result.notice ?? null)
  }

  return (
    <AuthLayout subtitle={isSignUp ? 'Create an account to start splitting bills.' : 'Sign in to split your bills.'}>
      {isSignUp && <TextField label="Name" value={name} onChangeText={setName} autoComplete="name" />}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={isSignUp ? 'new-password' : 'current-password'}
      />

      {error && <AppText variant="error">{error}</AppText>}
      {notice && <AppText>{notice}</AppText>}

      <Button title={isSignUp ? 'Create account' : 'Sign in'} onPress={submit} loading={submitting} />

      {!isSignUp && (
        <Link href="/forgot-password" style={authStyles.link}>
          <AppText variant="muted">Forgot your password?</AppText>
        </Link>
      )}

      <SocialSignIn onError={setError} />

      <Link href={isSignUp ? '/sign-in' : '/sign-up'} replace style={authStyles.link}>
        <AppText variant="muted">
          {isSignUp ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </AppText>
      </Link>
    </AuthLayout>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: { gap: Spacing.one, marginBottom: Spacing.three },
})
