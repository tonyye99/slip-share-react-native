import { useRouter } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { AuthField, FieldAction } from '@/components/auth/auth-field'
import { SignInHero } from '@/components/auth/sign-in-hero'
import { Logo } from '@/components/icons'
import { SocialSignIn } from '@/components/social-sign-in'
import { AppText, Button, Card } from '@/components/ui'
import { Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { openPrivacyPolicy } from '@/lib/consent'

// Forms read best narrow, even on a wide browser window.
const FORM_WIDTH = 440

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
            <View style={styles.brand}>
              <Logo size={36} />
              <AppText variant="title">SlipShare</AppText>
            </View>
            <AppText variant="muted">{subtitle}</AppText>
          </View>
          <Card style={styles.card}>{children}</Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export const authStyles = StyleSheet.create({
  link: { alignSelf: 'center', paddingVertical: Spacing.two },
})

/** Shared email/password form for the sign-in and sign-up screens, after Ye's "Sign in · v2" design. */
export function AuthForm({ mode, onSubmit }: AuthFormProps) {
  const theme = useTheme()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
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
    <View style={[styles.safe, { backgroundColor: theme.surface }]}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.page, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 24) }]}
          keyboardShouldPersistTaps="handled">
          <SignInHero width={Math.min(width, FORM_WIDTH) - 24} />

          <View style={styles.body}>
            <View>
              <AppText style={[styles.headline, { color: theme.text }]} accessibilityRole="header">
                {isSignUp ? 'Create your account' : 'Snap. Tap. Split.'}
              </AppText>
              <AppText style={[styles.subtitle, { color: theme.textSecondary }]}>
                Scan the receipt, tap who had what, send everyone their share.
              </AppText>
            </View>

            <View style={styles.fields}>
              {isSignUp && (
                <AuthField label="Name" value={name} onChangeText={setName} autoComplete="name" placeholder="Your name" />
              )}
              <AuthField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
              />
              <AuthField
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                placeholder={isSignUp ? 'At least 6 characters' : undefined}
                onSubmitEditing={submit}
                action={!isSignUp && <FieldAction title="Forgot?" onPress={() => router.push('/forgot-password')} />}
              />
            </View>

            {error && <AppText variant="error">{error}</AppText>}
            {notice && <AppText>{notice}</AppText>}

            <Button
              title={isSignUp ? 'Create account' : 'Sign in'}
              variant="strong"
              size="large"
              onPress={submit}
              loading={submitting}
            />

            <SocialSignIn onError={setError} />
          </View>

          <View style={styles.spacer} />

          <View style={styles.footer}>
            <AppText style={[styles.switch, { color: theme.textSecondary }]}>
              {isSignUp ? 'Already have an account? ' : 'New here? '}
              <AppText
                style={[styles.switch, styles.switchLink, { color: theme.primary }]}
                onPress={() => router.replace(isSignUp ? '/sign-in' : '/sign-up')}
                accessibilityRole="link">
                {isSignUp ? 'Sign in' : 'Create account'}
              </AppText>
            </AppText>
            {/* Social sign-in creates an account on either screen, so both show this. */}
            <AppText style={[styles.legal, { color: theme.textSecondary }]}>
              By continuing, you agree to the{' '}
              <AppText
                style={[styles.legal, styles.legalLink, { color: theme.primary }]}
                onPress={openPrivacyPolicy}
                accessibilityRole="link">
                Privacy Policy
              </AppText>
            </AppText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.three,
    paddingVertical: Spacing.five,
    gap: Spacing.three,
    width: '100%',
    maxWidth: FORM_WIDTH,
    alignSelf: 'center',
  },
  header: { gap: Spacing.two, alignItems: 'center', marginBottom: Spacing.one },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2 },
  card: { gap: Spacing.three, padding: Spacing.four - 4 },
  page: { flexGrow: 1, width: '100%', maxWidth: FORM_WIDTH, alignSelf: 'center' },
  body: { paddingHorizontal: 24, paddingTop: 19, gap: 14 },
  headline: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.9 },
  subtitle: { fontSize: 15, lineHeight: 20, marginTop: 3 },
  fields: { gap: 10, marginTop: 2 },
  spacer: { flexGrow: 1, minHeight: 24 },
  footer: { alignItems: 'center', gap: 14, paddingHorizontal: 24 },
  switch: { fontSize: 15, lineHeight: 20, textAlign: 'center' },
  switchLink: { fontWeight: '700' },
  legal: { fontSize: 12, lineHeight: 16, textAlign: 'center' },
  legalLink: { fontWeight: '600' },
})
