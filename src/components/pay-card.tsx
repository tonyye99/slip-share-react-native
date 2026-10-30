import { useEffect, useRef, useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'

import { CopyIcon, DownloadIcon, WalletIcon } from '@/components/icons'
import { QrCode } from '@/components/qr-code'
import { AppText, Button, Card, Segmented } from '@/components/ui'
import { Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'
import { track } from '@/lib/analytics'
import { copyText } from '@/lib/copy'
import { payTitle, type PayDetails } from '@/lib/pay-lines'
import { formatPromptPay, promptPayPayload } from '@/lib/promptpay'
import { saveQrImage } from '@/lib/qr'
import { formatMoney } from '@/lib/split'

/**
 * On the friend link, once you owe the owner: how to pay them, with the
 * exact amount. PromptPay shows a QR your banking app reads the amount from.
 */
export function PayCard({
  payerName,
  methods,
  amount,
  currency,
}: {
  payerName: string
  methods: PayDetails[]
  amount: number
  currency: string
}) {
  const theme = useTheme()
  const t = useT().pay
  const [index, setIndex] = useState(0)
  const method = methods[Math.min(index, methods.length - 1)]
  const money = formatMoney(amount, currency)
  // "Bank" fits a tab; the bank's own name is only needed to tell two apart.
  const banks = methods.filter((option) => option.kind === 'bank').length
  const tabLabel = (option: PayDetails) => (option.kind === 'bank' && banks === 1 ? t.bankName : payTitle(option))

  // Four or more don't fit side by side, so they scroll.
  const tabs = methods.length > 1 && (
    <Segmented
      stretch={methods.length <= 3}
      accessibilityLabel={t.stepOne}
      options={methods.map((option, i) => ({ value: String(i), label: tabLabel(option) }))}
      value={String(Math.min(index, methods.length - 1))}
      onChange={(value) => setIndex(Number(value))}
    />
  )

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.badge, { backgroundColor: theme.primarySoft }]}>
          <WalletIcon color={theme.primary} size={20} />
        </View>
        <View style={styles.flex}>
          <AppText variant="heading">{t.payTitle(payerName, money)}</AppText>
          <AppText variant="caption">{methods.length > 1 ? t.stepOne : t.stepOneOnly}</AppText>
        </View>
      </View>
      {tabs &&
        (methods.length > 3 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {tabs}
          </ScrollView>
        ) : (
          tabs
        ))}
      {method.kind === 'promptpay' ? (
        <PromptPay method={method} payerName={payerName} amount={amount} currency={currency} />
      ) : method.kind === 'bank' ? (
        <Bank method={method} amount={amount} money={money} />
      ) : (
        <AppText variant="body" style={styles.note}>
          {method.value}
        </AppText>
      )}
    </Card>
  )
}

/** "Copied" for a moment after a copy button works. */
function useCopied() {
  const [copied, setCopied] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  const copy = async (key: string, text: string) => {
    if (!(await copyText(text))) return
    setCopied(key)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(null), 2000)
  }
  return { copied, copy }
}

function PromptPay({
  method,
  payerName,
  amount,
  currency,
}: {
  method: PayDetails
  payerName: string
  amount: number
  currency: string
}) {
  const theme = useTheme()
  const t = useT().pay
  const { copied, copy } = useCopied()
  const [saving, setSaving] = useState(false)
  const to = method.name || payerName
  const money = formatMoney(amount, currency)
  const number = formatPromptPay(method.value)
  // PromptPay is in baht only, so a bill in another currency gets the number alone.
  const baht = currency.toUpperCase() === 'THB'
  const payload = baht ? promptPayPayload(method.value, amount) : null
  const web = Platform.OS === 'web'

  const saveQr = async () => {
    if (!payload) return
    setSaving(true)
    try {
      // Plain letters only: Chrome won't take ฿ in a file name.
      await saveQrImage(payload, [t.amountTo(money, to), t.promptpayNumber(number)], `PromptPay-${amount.toFixed(2)}-THB.png`)
      track('pay_qr_saved')
    } catch (e) {
      console.error('Saving the QR failed', e)
    } finally {
      setSaving(false)
    }
  }

  const copyButton = (
    <Button
      title={copied === 'number' ? t.copied : t.copyNumber}
      variant="secondary"
      icon={<CopyIcon color={theme.text} size={16} />}
      onPress={() => copy('number', method.value)}
      style={styles.flex}
    />
  )

  if (!payload) {
    return (
      <View style={styles.panel}>
        <AppText variant="caption">{t.notBaht}</AppText>
        <AppText variant="heading" style={styles.center}>
          {t.amountTo(money, to)}
        </AppText>
        <AppText variant="muted" style={styles.center}>
          {t.promptpayNumber(number)}
        </AppText>
        <View style={styles.actions}>{copyButton}</View>
      </View>
    )
  }

  return (
    <View style={styles.panel}>
      <View style={[styles.qrFrame, { borderColor: theme.border }]}>
        <QrCode value={payload} size={232} accessibilityLabel={t.qrA11y(money, to)} />
      </View>
      <View>
        <AppText variant="heading" style={styles.center}>
          {t.amountTo(money, to)}
        </AppText>
        <AppText variant="muted" style={styles.center}>
          {t.promptpayNumber(number)}
        </AppText>
      </View>
      <View style={styles.actions}>
        {web && (
          <Button
            title={t.saveQr}
            icon={<DownloadIcon color={theme.onPrimary} size={16} />}
            onPress={saveQr}
            loading={saving}
            style={styles.flex}
          />
        )}
        {copyButton}
      </View>
      {web && (
        <View style={[styles.hint, { backgroundColor: theme.primaryTint }]}>
          <AppText variant="caption">{t.saveQrHint}</AppText>
        </View>
      )}
    </View>
  )
}

function Bank({ method, amount, money }: { method: PayDetails; amount: number; money: string }) {
  const theme = useTheme()
  const t = useT().pay
  const { copied, copy } = useCopied()
  const rows: { key: string; label: string; value: string; copy?: string }[] = [
    { key: 'bank', label: t.bankName, value: method.bank ?? '' },
    { key: 'account', label: t.accountNumber, value: method.value, copy: method.value },
    ...(method.name ? [{ key: 'name', label: t.accountName, value: method.name }] : []),
    { key: 'amount', label: t.amount, value: money, copy: amount.toFixed(2) },
  ]
  return (
    <View>
      {rows.map((row, i) => (
        <View
          key={row.key}
          style={[styles.detail, i > 0 && { borderTopColor: theme.hairline, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <View style={styles.flex}>
            <AppText variant="caption">{row.label}</AppText>
            <AppText variant="heading" selectable>
              {row.value}
            </AppText>
          </View>
          {row.copy !== undefined && (
            <Pressable
              onPress={() => copy(row.key, row.copy!)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`${t.copy} ${row.label}`}
              style={({ pressed }) => [styles.copy, { opacity: pressed ? 0.6 : 1 }]}>
              <CopyIcon color={theme.primary} size={16} />
              <AppText variant="label" style={{ color: theme.primary }}>
                {copied === row.key ? t.copied : t.copy}
              </AppText>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: Spacing.three - 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4 },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  panel: { gap: Spacing.three - 4, alignItems: 'stretch' },
  qrFrame: { alignSelf: 'center', borderWidth: 1, borderRadius: Radius.large, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  center: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.two },
  hint: { borderRadius: Radius.medium, padding: Spacing.three - 4 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two + 2 },
  copy: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2 },
  note: { lineHeight: 23 },
})
