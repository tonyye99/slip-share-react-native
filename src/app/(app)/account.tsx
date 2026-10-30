import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'

import { AccountPhoto } from '@/components/account-photo'
import { SettingsGroup, SettingsRow } from '@/components/account/settings-list'
import { ChartIcon, GlobeIcon, ScanIcon, SendIcon, ShieldIcon, SignOutIcon, SlidersIcon, WalletIcon } from '@/components/icons'
import { LanguagePicker } from '@/components/language-picker'
import { ScreenHeader } from '@/components/screen-header'
import { Toggle } from '@/components/toggle'
import { AppText } from '@/components/ui'
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { dateLocale, useT } from '@/i18n'
import { deleteAccount } from '@/lib/account'
import { confirmAction, confirmDestructive, showAlert } from '@/lib/alert'
import { analyticsAvailable, analyticsOn, setAnalyticsOn } from '@/lib/analytics'
import { useAuth } from '@/lib/auth'
import { getAiConsent, giveAiConsent, openPrivacyPolicy, withdrawAiConsent } from '@/lib/consent'
import { sendFeedback } from '@/lib/feedback'
import { payTitle } from '@/lib/pay-lines'
import { listPayMethods, type PayMethod } from '@/lib/pay-methods'
import { supabase } from '@/lib/supabase'

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString(dateLocale(), { month: 'short', day: 'numeric', year: 'numeric' })

export default function AccountScreen() {
  const theme = useTheme()
  const t = useT()
  const { session } = useAuth()
  const [deleting, setDeleting] = useState(false)
  // 'checking' until loaded, 'unknown' if it couldn't be checked, null when scanning is off.
  const [consentedAt, setConsentedAt] = useState<string | null | 'checking' | 'unknown'>('checking')
  const [saving, setSaving] = useState(false)
  const [statsOn, setStatsOn] = useState(analyticsOn)
  // Your ways to get paid, for the line under How to pay me; null until loaded.
  const [payMethods, setPayMethods] = useState<PayMethod[] | null>(null)

  // Comes back here after adding or changing one.
  useFocusEffect(
    useCallback(() => {
      let live = true
      listPayMethods()
        .then((methods) => {
          if (live) setPayMethods(methods)
        })
        .catch((e) => console.error('Loading ways to get paid failed', e))
      return () => {
        live = false
      }
    }, []),
  )

  const toggleStats = (on: boolean) => {
    setStatsOn(on)
    setAnalyticsOn(on).catch((e) => console.error('Changing usage stats failed', e))
  }

  useEffect(() => {
    getAiConsent()
      .then(setConsentedAt)
      .catch((e) => {
        console.error('Consent check failed', e)
        setConsentedAt('unknown')
      })
  }, [])

  // "PromptPay, Kasikorn Bank", or a nudge to add one.
  const paySummary =
    payMethods === null
      ? ' '
      : payMethods.length > 0
        ? [...new Set(payMethods.map(payTitle))].join(', ')
        : t.pay.rowEmpty

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
      showAlert(t.account.scanningFailed(on), t.common.checkConnection)
    } finally {
      setSaving(false)
    }
  }

  // Turning it on is agreeing to send photos to OpenAI, so say what that means first.
  const toggleScanning = (on: boolean) =>
    on
      ? confirmAction(t.account.turnOnTitle, t.account.turnOnMessage, t.account.turnOn, () => setScanning(true))
      : setScanning(false)

  const scanningText = !known
    ? consentedAt === 'unknown'
      ? t.account.scanningUnknown
      : t.account.scanningChecking
    : consentedAt
      ? t.account.scanningAllowed(longDate(consentedAt))
      : t.account.scanningOff

  // Signing out locally sends the app back to the sign-in screen.
  const runDelete = async () => {
    setDeleting(true)
    try {
      await deleteAccount()
    } catch (e) {
      console.error('Delete account failed', e)
      setDeleting(false)
      showAlert(t.account.deleteFailed, t.common.checkConnection)
    }
  }

  const confirmDelete = () =>
    confirmDestructive(t.account.deleteTitle, t.account.deleteMessage, t.account.deleteAccount, runDelete)

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <ScreenHeader title={t.screens.account} plain />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <View style={styles.profile}>
          <AccountPhoto user={session?.user} size={76} ring={4} style={styles.photo} />
          <AppText style={[styles.email, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {session?.user.email ?? t.common.unknown}
          </AppText>
          <AppText variant="muted" style={[styles.signedIn, { color: theme.textSecondary }]}>
            {t.account.signedIn}
          </AppText>
        </View>

        <SettingsGroup title={t.pay.gettingPaid}>
          <SettingsRow
            tone="primary"
            icon={(color) => <WalletIcon color={color} size={18} />}
            title={t.pay.title}
            subtitle={paySummary}
            chevron
            onPress={() => router.push('/pay-methods')}
          />
        </SettingsGroup>

        <SettingsGroup title={t.account.privacy}>
          <SettingsRow
            tone="primary"
            icon={(color) => <ScanIcon color={color} size={16} lines={2} />}
            title={t.account.scanning}
            subtitle={scanningText}
            right={
              <Toggle
                value={scanningOn}
                onValueChange={toggleScanning}
                disabled={!known || saving || deleting}
                accessibilityLabel={t.account.scanning}
              />
            }
          />
          {analyticsAvailable && (
            <SettingsRow
              icon={(color) => <ChartIcon color={color} />}
              title={t.account.analytics}
              subtitle={statsOn ? t.account.analyticsOn : t.account.analyticsOff}
              right={<Toggle value={statsOn} onValueChange={toggleStats} accessibilityLabel={t.account.analytics} />}
            />
          )}
          <SettingsRow
            icon={(color) => <ShieldIcon color={color} />}
            title={t.account.privacyPolicy}
            chevron
            onPress={openPrivacyPolicy}
            accessibilityHint={t.account.privacyPolicyHint}
          />
        </SettingsGroup>

        <SettingsGroup title={t.account.app}>
          <SettingsRow
            icon={(color) => <GlobeIcon color={color} />}
            title={t.language.title}
            right={<LanguagePicker background={theme.backgroundElement} />}
          />
          {/* Browsers can't open the phone's settings, so the website leaves this out. */}
          {Platform.OS !== 'web' && (
            <SettingsRow
              icon={(color, tile) => <SlidersIcon color={color} background={tile} />}
              title={t.account.settings}
              chevron
              onPress={() => Linking.openSettings()}
              accessibilityHint={t.account.settingsHint}
            />
          )}
          <SettingsRow
            icon={(color) => <SendIcon color={color} />}
            title={t.feedback.title}
            chevron
            onPress={sendFeedback}
            accessibilityHint={t.feedback.hint}
          />
          <SettingsRow
            icon={(color) => <SignOutIcon color={color} />}
            title={t.account.signOut}
            onPress={() => supabase.auth.signOut()}
            disabled={deleting}
          />
        </SettingsGroup>

        <View style={styles.danger}>
          <Pressable
            onPress={confirmDelete}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel={t.account.deleteAccount}
            accessibilityState={{ busy: deleting }}
            style={({ pressed }) => [styles.delete, { backgroundColor: pressed ? theme.dangerSoft : theme.surface }]}>
            {deleting ? (
              <ActivityIndicator color={theme.danger} />
            ) : (
              <AppText style={[styles.deleteText, { color: theme.danger }]}>{t.account.deleteAccount}</AppText>
            )}
          </Pressable>
          <AppText variant="caption" style={[styles.note, { color: theme.textSecondary }]}>
            {t.account.deleteNote}
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
