import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { ImageIcon, SendIcon } from '@/components/icons'
import { QrCode } from '@/components/qr-code'
import { Sheet } from '@/components/sheet'
import { AppText, Button, Tag } from '@/components/ui'
import { Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'
import { track } from '@/lib/analytics'
import { formatPromptPay } from '@/lib/promptpay'
import { shareQrPicture } from '@/lib/qr-picture'

/**
 * Send totals on a bill you paid, when you have PromptPay: the message for
 * the group, then your QR as a picture. Group chats usually get both, one
 * after the other, and a phone can't share text and a picture in one go.
 */
export function SendTotalsSheet({
  visible,
  onClose,
  message,
  qr,
  onSendMessage,
}: {
  visible: boolean
  onClose: () => void
  message: string
  /** Your PromptPay QR with no amount in it, and who it pays. */
  qr: { payload: string; id: string | null; name: string | null }
  onSendMessage: () => Promise<void>
}) {
  const theme = useTheme()
  const t = useT()
  const [sent, setSent] = useState({ message: false, qr: false })
  const [sharing, setSharing] = useState(false)
  // Each time the sheet opens, both steps start again.
  const [wasVisible, setWasVisible] = useState(visible)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (visible) setSent({ message: false, qr: false })
  }

  const name = qr.name ?? t.pay.promptpay
  const sendMessage = async () => {
    await onSendMessage()
    setSent((now) => ({ ...now, message: true }))
  }
  const sendQr = async () => {
    setSharing(true)
    try {
      await shareQrPicture(qr.payload, {
        caption: qr.id ? [name, t.pay.promptpayNumber(formatPromptPay(qr.id))] : [name, t.pay.promptpay],
        // Plain letters only: some apps drop a file name with Thai in it.
        fileName: 'PromptPay-QR.png',
        title: t.totals.qrStep,
      })
      track('totals_qr_sent')
      setSent((now) => ({ ...now, qr: true }))
    } catch (e) {
      console.error('Sharing the QR failed', e)
    } finally {
      setSharing(false)
    }
  }

  const step = (number: number, title: string, done: boolean) => (
    <View style={styles.stepRow}>
      <View style={[styles.number, { backgroundColor: done ? theme.successSoft : theme.primarySoft }]}>
        <AppText variant="label" style={{ color: done ? theme.success : theme.primary }}>
          {number}
        </AppText>
      </View>
      <AppText variant="heading" style={styles.flex}>
        {title}
      </AppText>
      {done ? <Tag label={t.totals.sent} tone="success" /> : null}
    </View>
  )

  return (
    <Sheet visible={visible} onClose={onClose} title={t.totals.sendTitle} subtitle={t.totals.sendSubtitle}>
      <View style={styles.section}>
        {step(1, t.totals.messageStep, sent.message)}
        <View style={[styles.bubble, { backgroundColor: theme.background, borderColor: theme.hairline }]}>
          <AppText variant="body" style={styles.message} selectable>
            {message}
          </AppText>
        </View>
        <Button
          title={t.totals.sendMessage}
          icon={<SendIcon color={theme.onPrimary} />}
          variant={sent.message ? 'secondary' : 'primary'}
          onPress={sendMessage}
        />
      </View>

      <View style={[styles.section, styles.qrSection, { borderTopColor: theme.hairline }]}>
        {step(2, t.totals.qrStep, sent.qr)}
        <View style={[styles.qrFrame, { borderColor: theme.border }]}>
          <QrCode value={qr.payload} size={176} accessibilityLabel={t.totals.qrA11y(name)} />
        </View>
        <AppText variant="caption" style={styles.center}>
          {t.totals.qrNoAmount}
        </AppText>
        <Button
          title={t.totals.sendQr}
          icon={<ImageIcon color={sent.message && !sent.qr ? theme.onPrimary : theme.text} size={18} />}
          variant={sent.message && !sent.qr ? 'primary' : 'secondary'}
          onPress={sendQr}
          loading={sharing}
        />
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: Spacing.three - 4 },
  qrSection: { marginTop: Spacing.three, paddingTop: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  number: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  bubble: { borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three - 4 },
  message: { fontSize: 15, lineHeight: 21 },
  qrFrame: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: Radius.large,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  center: { textAlign: 'center' },
})
