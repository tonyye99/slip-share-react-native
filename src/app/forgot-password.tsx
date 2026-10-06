import { Link } from 'expo-router'
import { useState } from 'react'

import { AuthLayout, authStyles } from '@/components/auth-form'
import { AppText, Button, TextField } from '@/components/ui'
import { resetPasswordUrl } from '@/lib/auth-links'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const submit = async () => {
    if (!email.trim()) {
      setError('Enter the email you signed up with.')
      return
    }
    setBusy(true)
    setError(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: resetPasswordUrl(),
    })
    setBusy(false)
    if (resetError) setError(resetError.message)
    else setSent(true)
  }

  return (
    <AuthLayout subtitle="We'll email you a link to choose a new password.">
      {sent ? (
        <AppText>Check your email and open the link on this phone to set a new password.</AppText>
      ) : (
        <>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          {error && <AppText variant="error">{error}</AppText>}
          <Button title="Send reset link" onPress={submit} loading={busy} />
        </>
      )}
      <Link href="/sign-in" replace style={authStyles.link}>
        <AppText variant="muted">Back to sign in</AppText>
      </Link>
    </AuthLayout>
  )
}
