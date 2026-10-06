import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator } from 'react-native'

import { AuthLayout, authStyles } from '@/components/auth-form'
import { AppText, Button, TextField } from '@/components/ui'
import { completeAuthRedirect, type AuthRedirectParams } from '@/lib/auth-links'
import { supabase } from '@/lib/supabase'

// slipshare://reset-password?code=…, from the password reset email. The code
// signs the person in for this one purpose; then they choose a new password.
export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<Record<keyof AuthRedirectParams, string>>()
  const [ready, setReady] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    completeAuthRedirect(params)
      .then(() => setReady(true))
      .catch((e) => {
        console.error('Reset link failed', e)
        setLinkError('This reset link has expired or was opened on another device. Request a new one.')
      })
    // The params are fixed for the life of this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async () => {
    if (password.length < 6) {
      setError('Use at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError("The passwords don't match.")
      return
    }
    setSubmitting(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSubmitting(false)
    if (updateError) setError(updateError.message)
    else router.replace('/')
  }

  if (linkError) {
    return (
      <AuthLayout subtitle="Reset your password">
        <AppText variant="error">{linkError}</AppText>
        <Button title="Send a new link" variant="secondary" onPress={() => router.replace('/forgot-password')} />
      </AuthLayout>
    )
  }

  if (!ready) {
    return (
      <AuthLayout subtitle="Reset your password">
        <ActivityIndicator style={authStyles.link} />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout subtitle="Choose a new password">
      <TextField label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <TextField label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
      {error && <AppText variant="error">{error}</AppText>}
      <Button title="Save password" onPress={submit} loading={submitting} />
    </AuthLayout>
  )
}
