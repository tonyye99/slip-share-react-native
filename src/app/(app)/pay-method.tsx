import type { User } from '@supabase/supabase-js'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'

import { QrIcon } from '@/components/icons'
import { QrCode } from '@/components/qr-code'
import { ScreenHeader } from '@/components/screen-header'
import { AppText, Button, Card, Input } from '@/components/ui'
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'
import { confirmDestructive, showAlert } from '@/lib/alert'
import { track } from '@/lib/analytics'
import { useAuth } from '@/lib/auth'
import { cleanBankAccount, cleanText, type PayDetails, type PayMethodKind } from '@/lib/pay-lines'
import { addPayMethod, getPayMethod, isTooMany, removePayMethod, updatePayMethod } from '@/lib/pay-methods'
import { formatPromptPay, normalizePromptPay, promptPayPayload, validPromptPay } from '@/lib/promptpay'
import { formatMoney } from '@/lib/split'

// The amount in the example QR. Scanning it with your own banking app shows
// your name, so you know friends will be paying the right person.
const EXAMPLE_AMOUNT = 117.7

const kinds: PayMethodKind[] = ['promptpay', 'bank', 'note']

/** The name you signed up with, to start the "Name friends see" box. */
function nameFrom(user: User | undefined): string {
  const meta = user?.user_metadata ?? {}
  const name = [meta.display_name, meta.full_name, meta.name].find((value) => typeof value === 'string' && value.trim())
  return typeof name === 'string' ? name.trim() : ''
}

// Add or change one way to get paid: /pay-method?kind=promptpay, or ?id= to change one.
export default function PayMethodScreen() {
  const params = useLocalSearchParams<{ kind?: string; id?: string }>()
  const id = params.id
  const theme = useTheme()
  const t = useT()
  const { session } = useAuth()
  const [kind, setKind] = useState<PayMethodKind>(() =>
    kinds.includes(params.kind as PayMethodKind) ? (params.kind as PayMethodKind) : 'promptpay',
  )
  const [loaded, setLoaded] = useState(!id)
  const [value, setValue] = useState('')
  const [bank, setBank] = useState('')
  const [savedBank, setSavedBank] = useState<string | null>(null)
  const [name, setName] = useState(() => (id ? '' : nameFrom(session?.user)))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    let live = true
    getPayMethod(id)
      .then((method) => {
        if (!live) return
        if (!method) {
          router.back()
          return
        }
        setKind(method.kind)
        setValue(method.kind === 'promptpay' ? formatPromptPay(method.value) : method.value)
        setBank(method.bank ?? '')
        setSavedBank(method.bank)
        setName(method.name ?? '')
        setLoaded(true)
      })
      .catch((e) => {
        console.error('Loading a way to get paid failed', e)
        if (live) setLoaded(true)
      })
    return () => {
      live = false
    }
  }, [id])

  const title =
    kind === 'promptpay' ? t.pay.promptpay : kind === 'bank' ? (savedBank ?? t.pay.bank) : t.pay.noteTitle
  const digits = normalizePromptPay(value)
  const preview = kind === 'promptpay' && validPromptPay(digits) ? promptPayPayload(digits, EXAMPLE_AMOUNT) : null

  const details = (): PayDetails | null => {
    if (kind === 'promptpay') {
      if (!validPromptPay(digits)) {
        showAlert(t.pay.checkNumber, t.pay.checkNumberMessage)
        return null
      }
      return { kind, value: digits, bank: null, name: cleanText(name) }
    }
    if (kind === 'bank') {
      const account = cleanBankAccount(value)
      const bankName = cleanText(bank)
      if (!account || !bankName) {
        showAlert(t.pay.checkAccount, t.pay.checkAccountMessage)
        return null
      }
      return { kind, value: account, bank: bankName, name: cleanText(name) }
    }
    const text = value.trim()
    if (!text) {
      showAlert(t.pay.couldNotSave, t.pay.writeSomething)
      return null
    }
    return { kind, value: text, bank: null, name: null }
  }

  const save = async () => {
    const method = details()
    if (!method) return
    setSaving(true)
    try {
      if (id) await updatePayMethod(id, method)
      else await addPayMethod(method)
      track('pay_method_saved', { kind, added: !id })
      router.back()
    } catch (e) {
      console.error('Saving a way to get paid failed', e)
      showAlert(t.pay.couldNotSave, isTooMany(e) ? t.pay.tooMany : t.common.checkConnection)
      setSaving(false)
    }
  }

  const remove = () =>
    confirmDestructive(t.pay.removeTitle(title), t.pay.removeMessage, t.common.remove, async () => {
      if (!id) return
      setSaving(true)
      try {
        await removePayMethod(id)
        router.back()
      } catch (e) {
        console.error('Removing a way to get paid failed', e)
        showAlert(t.pay.couldNotRemove, t.common.checkConnection)
        setSaving(false)
      }
    })

  const field = (label: string, input: ReactNode, hint?: string) => (
    <View style={styles.field}>
      <AppText variant="label">{label}</AppText>
      {input}
      {hint ? <AppText variant="caption">{hint}</AppText> : null}
    </View>
  )

  const nameField = field(
    kind === 'bank' ? t.pay.accountNameLabel : t.pay.nameLabel,
    <Input
      value={name}
      onChangeText={setName}
      placeholder={t.pay.namePlaceholder}
      maxLength={60}
      autoCapitalize="words"
      autoCorrect={false}
      accessibilityLabel={kind === 'bank' ? t.pay.accountNameLabel : t.pay.nameLabel}
    />,
    t.pay.nameHint,
  )

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <ScreenHeader title={title} plain />
      {!loaded ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets>
          <Card style={styles.card}>
            {kind === 'promptpay' && (
              <>
                {field(
                  t.pay.numberLabel,
                  <Input
                    value={value}
                    onChangeText={setValue}
                    placeholder="081 234 5678"
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    maxLength={24}
                    accessibilityLabel={t.pay.numberLabel}
                  />,
                  t.pay.numberHint,
                )}
                {nameField}
              </>
            )}
            {kind === 'bank' && (
              <>
                {field(
                  t.pay.bankLabel,
                  <Input
                    value={bank}
                    onChangeText={setBank}
                    placeholder={t.pay.bankPlaceholder}
                    maxLength={60}
                    autoCapitalize="words"
                    accessibilityLabel={t.pay.bankLabel}
                  />,
                )}
                {field(
                  t.pay.accountLabel,
                  <Input
                    value={value}
                    onChangeText={setValue}
                    placeholder="123-4-56789-0"
                    keyboardType="numbers-and-punctuation"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={41}
                    accessibilityLabel={t.pay.accountLabel}
                  />,
                )}
                {nameField}
              </>
            )}
            {kind === 'note' &&
              field(
                t.pay.noteLabel,
                <Input
                  value={value}
                  onChangeText={setValue}
                  placeholder={t.pay.notePlaceholder}
                  maxLength={300}
                  multiline
                  accessibilityLabel={t.pay.noteLabel}
                  style={styles.noteInput}
                />,
              )}
          </Card>

          {kind === 'promptpay' && (
            <Card style={styles.preview}>
              <AppText variant="overline" style={{ color: theme.textSecondary }}>
                {t.pay.whatFriendsSee}
              </AppText>
              {preview ? (
                <>
                  <View style={[styles.qrFrame, { borderColor: theme.border }]}>
                    <QrCode
                      value={preview}
                      size={196}
                      accessibilityLabel={t.pay.qrA11y(formatMoney(EXAMPLE_AMOUNT, 'THB'), cleanText(name) ?? '')}
                    />
                  </View>
                  <AppText variant="heading" style={styles.center}>
                    {t.pay.exampleAmount(formatMoney(EXAMPLE_AMOUNT, 'THB'))}
                  </AppText>
                  <AppText variant="caption" style={styles.center}>
                    {t.pay.scanToCheck}
                  </AppText>
                </>
              ) : (
                <>
                  <View style={[styles.qrEmpty, { borderColor: theme.border }]}>
                    <QrIcon color={theme.border} size={56} weight={3} />
                  </View>
                  <AppText variant="caption" style={styles.center}>
                    {t.pay.typeNumber}
                  </AppText>
                </>
              )}
            </Card>
          )}

          <Button title={t.pay.save} onPress={save} loading={saving} size="large" />
          {id ? <Button title={t.pay.removeThis(title)} variant="danger" onPress={remove} disabled={saving} /> : null}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { marginTop: Spacing.five },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: { gap: Spacing.three },
  field: { gap: Spacing.one + 2 },
  noteInput: { minHeight: 104, paddingTop: Spacing.three - 4, textAlignVertical: 'top' },
  preview: { alignItems: 'center', gap: Spacing.two + 2, paddingVertical: Spacing.three + 4 },
  qrFrame: { borderWidth: 1, borderRadius: Radius.large, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  qrEmpty: {
    width: 196,
    height: 196,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.large,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
})
