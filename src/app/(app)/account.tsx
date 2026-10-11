import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import { Avatar } from '@/components/chip'
import { ScreenHeader } from '@/components/screen-header'
import { AppText, Button, Card, Tag, TextLink } from '@/components/ui'
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
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
    <ScreenHeader title="Account" />
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Card>
        <View style={styles.who}>
          <Avatar name={session?.user.email ?? '?'} color={theme.primary} size={44} />
          <View style={styles.flex}>
            <AppText variant="caption">Signed in as</AppText>
            <AppText variant="heading" numberOfLines={1}>
              {session?.user.email ?? 'Unknown'}
            </AppText>
          </View>
        </View>
        <Button title="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} disabled={deleting} />
      </Card>

      <Card>
        <View style={styles.titleRow}>
          <AppText variant="heading" style={styles.flex}>
            Privacy
          </AppText>
          {consentedAt !== undefined && (
            <Tag label={consentedAt ? 'Scanning on' : 'Scanning off'} tone={consentedAt ? 'success' : 'neutral'} />
          )}
        </View>
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
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  who: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4, marginBottom: Spacing.one },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  content: { padding: Spacing.three, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
})
