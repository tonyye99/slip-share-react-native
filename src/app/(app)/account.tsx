import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'

import { AppText, Button, Card, TextLink } from '@/components/ui'
import { MaxContentWidth, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { deleteAccount } from '@/lib/account'
import { confirmDestructive, showAlert } from '@/lib/alert'
import { useAuth } from '@/lib/auth'
import { getAiConsent, openPrivacyPolicy, withdrawAiConsent } from '@/lib/consent'
import { supabase } from '@/lib/supabase'

export default function AccountScreen() {
  const theme = useTheme()
  const { session } = useAuth()
  const [deleting, setDeleting] = useState(false)
  // undefined until loaded (or if it couldn't be checked), null when scanning is off.
  const [consentedAt, setConsentedAt] = useState<string | null>()
  const [turningOff, setTurningOff] = useState(false)

  useEffect(() => {
    getAiConsent()
      .then(setConsentedAt)
      .catch((e) => console.error('Consent check failed', e))
  }, [])

  const turnOffScanning = async () => {
    if (!session) return
    setTurningOff(true)
    try {
      await withdrawAiConsent(session.user.id)
      setConsentedAt(null)
    } catch (e) {
      console.error('Turning off scanning failed', e)
      showAlert('Could not turn off scanning', 'Please check your connection and try again.')
    } finally {
      setTurningOff(false)
    }
  }

  // Signing out locally sends the app back to the sign-in screen.
  const runDelete = async () => {
    setDeleting(true)
    try {
      await deleteAccount()
    } catch (e) {
      console.error('Delete account failed', e)
      setDeleting(false)
      showAlert('Could not delete your account', 'Please check your connection and try again.')
    }
  }

  const confirmDelete = () =>
    confirmDestructive(
      'Delete your account?',
      "Your receipts, and the names and payments on them, will be deleted for good. This can't be undone.",
      'Delete account',
      runDelete,
    )

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <Card>
        <AppText variant="muted">Signed in as</AppText>
        <AppText variant="heading">{session?.user.email ?? 'Unknown'}</AppText>
        <Button title="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} disabled={deleting} />
      </Card>

      <Card>
        <AppText variant="heading">Privacy</AppText>
        {consentedAt && (
          <>
            <AppText variant="muted">
              Receipt scanning is on. You allowed SlipShare to send receipt photos to OpenAI on{' '}
              {new Date(consentedAt).toLocaleDateString()}.
            </AppText>
            <Button title="Turn off scanning" variant="secondary" onPress={turnOffScanning} loading={turningOff} />
          </>
        )}
        {consentedAt === null && (
          <AppText variant="muted">
            Receipt scanning is off. The app will ask before sending a photo to OpenAI.
          </AppText>
        )}
        <TextLink title="Read the privacy policy" onPress={openPrivacyPolicy} />
      </Card>

      <Card>
        <AppText variant="heading">Delete account</AppText>
        <AppText variant="muted">
          Removes your account and every receipt you scanned, with the names and payments on it. This also
          deletes your account on the SlipShare website.
        </AppText>
        <Button title="Delete account" variant="danger" onPress={confirmDelete} loading={deleting} />
      </Card>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
})
