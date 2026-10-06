import { Link } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AppText, Button, TextField } from '@/components/ui'
import { MaxContentWidth, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

export interface AuthResult {
  error?: string
  notice?: string
}

interface AuthFormProps {
  mode: 'sign-in' | 'sign-up'
  onSubmit: (values: { name: string; email: string; password: string }) => Promise<AuthResult>
}

/** Shared email/password form for the sign-in and sign-up screens. */
export function AuthForm({ mode, onSubmit }: AuthFormProps) {
  const theme = useTheme()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const signUp = mode === 'sign-up'

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      setError('Enter your email and a password of at least 6 characters.')
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    const result = await onSubmit({ name: name.trim(), email: email.trim(), password })
    setBusy(false)
    setError(result.error ?? null)
    setNotice(result.notice ?? null)
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <AppText variant="title">SlipShare</AppText>
            <AppText variant="muted">{signUp ? 'Create an account to start splitting bills.' : 'Sign in to split your bills.'}</AppText>
          </View>

          {signUp && <TextField label="Name" value={name} onChangeText={setName} autoComplete="name" />}
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
            autoComplete={signUp ? 'new-password' : 'current-password'}
          />

          {error && <AppText variant="error">{error}</AppText>}
          {notice && <AppText>{notice}</AppText>}

          <Button title={signUp ? 'Create account' : 'Sign in'} onPress={submit} loading={busy} />

          <Link href={signUp ? '/sign-in' : '/sign-up'} replace style={styles.link}>
            <AppText variant="muted">
              {signUp ? 'Already have an account? Sign in' : 'New here? Create an account'}
            </AppText>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  link: { alignSelf: 'center', paddingVertical: Spacing.two },
})
