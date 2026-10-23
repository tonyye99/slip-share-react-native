import { Link } from 'expo-router'
import { useState } from 'react'

import { AuthLayout, authStyles } from '@/components/auth-form'
import { AppText, Button, TextField } from '@/components/ui'
import { useT } from '@/i18n'
import { resetPasswordUrl } from '@/lib/auth-links'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordScreen() {
  const t = useT()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const submit = async () => {
    if (!email.trim()) {
      setError(t.auth.enterSignUpEmail)
      return
    }
    setSubmitting(true)
    setError(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: resetPasswordUrl(),
    })
    setSubmitting(false)
    if (resetError) setError(t.auth.errorText(resetError.message))
    else setSent(true)
  }

  return (
    <AuthLayout subtitle={t.auth.forgotSubtitle}>
      {sent ? (
        <AppText>{t.auth.checkEmailForReset}</AppText>
      ) : (
        <>
          <TextField
            label={t.auth.email}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          {error && <AppText variant="error">{error}</AppText>}
          <Button title={t.auth.sendResetLink} onPress={submit} loading={submitting} />
        </>
      )}
      <Link href="/sign-in" replace style={authStyles.link}>
        <AppText variant="muted">{t.auth.backToSignIn}</AppText>
      </Link>
    </AuthLayout>
  )
}
