import { useEffect, useState } from 'react'
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'

import { AccountPhoto } from '@/components/account-photo'
import { SettingsGroup, SettingsRow } from '@/components/account/settings-list'
import { ScanIcon, ShieldIcon, SignOutIcon, SlidersIcon } from '@/components/icons'
import { ScreenHeader } from '@/components/screen-header'
import { Toggle } from '@/components/toggle'
import { AppText } from '@/components/ui'
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { deleteAccount } from '@/lib/account'
import { confirmAction, confirmDestructive, showAlert } from '@/lib/alert'
import { useAuth } from '@/lib/auth'
import { getAiConsent, giveAiConsent, openPrivacyPolicy, withdrawAiConsent } from '@/lib/consent'
import { supabase } from '@/lib/supabase'

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

export default function AccountScreen() {
  const theme = useTheme()
  const { session } = useAuth()
  const [deleting, setDeleting] = useState(false)
  // 'checking' until loaded, 'unknown' if it couldn't be checked, null when scanning is off.
  const [consentedAt, setConsentedAt] = useState<string | null | 'checking' | 'unknown'>('checking')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getAiConsent()
      .then(setConsentedAt)
      .catch((e) => {
        console.error('Consent check failed', e)
        setConsentedAt('unknown')
      })
  }, [])

  const known = consentedAt !== 'checking' && consentedAt !== 'unknown'
  const scanningOn = known && consentedAt !== null

  const setScanning = async (on: boolean) => {
    if (!session) return
    setSaving(true)
    try {
      if (on) {
        await giveAiConsent(session.user.id)
        setConsentedAt(await getAiConsent())
      } else {
        await withdrawAiConsent(session.user.id)
        setConsentedAt(null)
      }
    } catch (e) {
      console.error('Changing receipt scanning failed', e)
      showAlert(`Could not turn ${on ? 'on' : 'off'} scanning`, 'Please check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  // Turning it on is agreeing to send photos to OpenAI, so say what that means first.
  const toggleScanning = (on: boolean) =>
    on
      ? confirmAction(
          'Turn on receipt scanning?',
          "When you scan, the photo is sent to OpenAI to read the items. SlipShare doesn't keep it, and OpenAI doesn't train on it.",
          'Turn on',
          () => setScanning(true),
        )
      : setScanning(false)

  const scanningText = !known
    ? consentedAt === 'unknown'
      ? "Photos are read by OpenAI. We couldn't check this right now."
      : 'Photos are read by OpenAI.'
    : consentedAt
      ? `Photos are read by OpenAI. You allowed this on ${longDate(consentedAt)}.`
      : 'Off. Photos are read by OpenAI, so the app asks first.'

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
      <ScreenHeader title="Account" plain />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <View style={styles.profile}>
          <AccountPhoto user={session?.user} size={76} ring={4} style={styles.photo} />
          <AppText style={[styles.email, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {session?.user.email ?? 'Unknown'}
          </AppText>
          <AppText variant="muted" style={[styles.signedIn, { color: theme.textSecondary }]}>
            Signed in
          </AppText>
        </View>

        <SettingsGroup title="Privacy">
          <SettingsRow
            tone="primary"
            icon={(color) => <ScanIcon color={color} size={16} lines={2} />}
            title="Receipt scanning"
            subtitle={scanningText}
            right={
              <Toggle
                value={scanningOn}
                onValueChange={toggleScanning}
                disabled={!known || saving || deleting}
                accessibilityLabel="Receipt scanning"
              />
            }
          />
          <SettingsRow
            icon={(color) => <ShieldIcon color={color} />}
            title="Privacy policy"
            chevron
            onPress={openPrivacyPolicy}
            accessibilityHint="Opens the privacy policy"
          />
        </SettingsGroup>

        <SettingsGroup title="App">
          {/* Browsers can't open the phone's settings, so the website leaves this out. */}
          {Platform.OS !== 'web' && (
            <SettingsRow
              icon={(color, tile) => <SlidersIcon color={color} background={tile} />}
              title="Settings"
              chevron
              onPress={() => Linking.openSettings()}
              accessibilityHint="Opens SlipShare in your phone's Settings, like camera and photo access"
            />
          )}
          <SettingsRow
            icon={(color) => <SignOutIcon color={color} />}
            title="Sign out"
            onPress={() => supabase.auth.signOut()}
            disabled={deleting}
          />
        </SettingsGroup>

        <View style={styles.danger}>
          <Pressable
            onPress={confirmDelete}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel="Delete account"
            accessibilityState={{ busy: deleting }}
            style={({ pressed }) => [styles.delete, { backgroundColor: pressed ? theme.dangerSoft : theme.surface }]}>
            {deleting ? (
              <ActivityIndicator color={theme.danger} />
            ) : (
              <AppText style={[styles.deleteText, { color: theme.danger }]}>Delete account</AppText>
            )}
          </Pressable>
          <AppText variant="caption" style={[styles.note, { color: theme.textSecondary }]}>
            Deletes your account, every bill you scanned and the names and payments on them, on the app and the website.
          </AppText>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three + 2,
    paddingBottom: Spacing.five,
    gap: Spacing.four - 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  profile: { alignItems: 'center' },
  photo: { boxShadow: '0 8px 24px rgba(16, 24, 27, 0.14)', marginBottom: Spacing.two },
  email: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.3, textAlign: 'center' },
  signedIn: { fontSize: 15 },
  danger: { gap: Spacing.two + 2, marginTop: Spacing.two + 1 },
  delete: { minHeight: 54, borderRadius: Radius.large + 6, alignItems: 'center', justifyContent: 'center' },
  deleteText: { fontSize: 17, fontWeight: '700' },
  note: { lineHeight: 17, marginHorizontal: Spacing.three },
})
