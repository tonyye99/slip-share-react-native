import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator } from 'react-native'

import { AuthLayout, authStyles } from '@/components/auth-form'
import { AppText, Button, TextField } from '@/components/ui'
import { useT } from '@/i18n'
import { completeAuthRedirect, type AuthRedirectParams } from '@/lib/auth-links'
import { supabase } from '@/lib/supabase'

// slipshare://reset-password?code=…, from the password reset email. The code
// signs the person in for this one purpose; then they choose a new password.
export default function ResetPasswordScreen() {
  const t = useT()
  const params = useLocalSearchParams<Record<keyof AuthRedirectParams, string>>()
  const [ready, setReady] = useState(false)
  const [linkFailed, setLinkFailed] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    completeAuthRedirect(params)
      .then(() => setReady(true))
      .catch((e) => {
        console.error('Reset link failed', e)
        setLinkFailed(true)
      })
    // The params are fixed for the life of this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async () => {
    if (password.length < 6) {
      setError(t.auth.useSixCharacters)
      return
    }
    if (password !== confirm) {
      setError(t.auth.passwordsDontMatch)
      return
    }
    setSubmitting(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSubmitting(false)
    if (updateError) setError(t.auth.errorText(updateError.message))
    else router.replace('/')
  }

  if (linkFailed) {
    return (
      <AuthLayout subtitle={t.auth.resetTitle}>
        <AppText variant="error">{t.auth.resetExpired}</AppText>
        <Button title={t.auth.sendNewLink} variant="secondary" onPress={() => router.replace('/forgot-password')} />
      </AuthLayout>
    )
  }

  if (!ready) {
    return (
      <AuthLayout subtitle={t.auth.resetTitle}>
        <ActivityIndicator style={authStyles.link} />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout subtitle={t.auth.chooseNewPassword}>
      <TextField
        label={t.auth.newPassword}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
      />
      <TextField
        label={t.auth.confirmPassword}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoComplete="new-password"
      />
      {error && <AppText variant="error">{error}</AppText>}
      <Button title={t.auth.savePassword} onPress={submit} loading={submitting} />
    </AuthLayout>
  )
}
