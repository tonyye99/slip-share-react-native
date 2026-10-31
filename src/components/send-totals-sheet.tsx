import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { SendIcon } from '@/components/icons'
import { QrCode } from '@/components/qr-code'
import { Sheet } from '@/components/sheet'
import { Toggle } from '@/components/toggle'
import { AppText, Button, Segmented } from '@/components/ui'
import { Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'
import { track } from '@/lib/analytics'
import { formatPromptPay } from '@/lib/promptpay'
import { pastesMessage, shareWithQr } from '@/lib/qr-picture'
import { secureStorage } from '@/lib/secure-storage'
import { shareText } from '@/lib/share-text'

const MATHS_KEY = 'slipshare.totalsMaths'

/**
 * Send totals: shows the message as the group will get it, then sends it.
 * On a bill you paid with PromptPay set up, your QR goes with it. On a bill
 * someone else paid, you can send them just your own share.
 */
export function SendTotalsSheet({
  visible,
  onClose,
  message,
  myMessage,
  qr,
}: {
  visible: boolean
  onClose: () => void
  /** The message, with or without how each amount is worked out. */
  message: (maths: boolean) => string
  /** Just your own share, on a bill someone else paid. */
  myMessage: ((maths: boolean) => string) | null
  /** Your PromptPay QR with no amount in it, and who it pays. */
  qr: { payload: string; id: string | null; name: string | null } | null
}) {
  const theme = useTheme()
  const t = useT()
  const [sharing, setSharing] = useState(false)
  // "Show the maths" stays as you last left it.
  const [maths, setMaths] = useState(false)
  useEffect(() => {
    secureStorage
      .getItem(MATHS_KEY)
      .then((saved) => setMaths(saved === '1'))
      .catch((e) => console.error('Could not load the maths setting', e))
  }, [])
  const changeMaths = (on: boolean) => {
    setMaths(on)
    secureStorage.setItem(MATHS_KEY, on ? '1' : '0').catch((e) => console.error('Could not save the maths setting', e))
  }

  const [who, setWho] = useState<'me' | 'everyone'>('me')
  const write = myMessage && who === 'me' ? myMessage : message
  // Only worked out while the sheet is open: the split screen redraws on every tap.
  const text = visible ? write(maths) : ''
  // A bill with no service or tax has no maths to show.
  const hasMaths = visible && write(true) !== write(false)
  const name = qr?.name ?? t.pay.promptpay

  const send = async () => {
    setSharing(true)
    try {
      if (qr) {
        const sent = await shareWithQr(text, qr.payload, {
          caption: qr.id ? [name, t.pay.promptpayNumber(formatPromptPay(qr.id))] : [name, t.pay.promptpay],
          // Plain letters only: some apps drop a file name with Thai in it.
          fileName: 'PromptPay-QR.png',
          title: t.totals.sendTitle,
        })
        if (!sent) return
        track('totals_qr_sent')
      } else {
        await shareText(text)
      }
      track('totals_sent', { maths, just_me: write === myMessage })
      onClose()
    } catch (e) {
      console.error('Sharing the totals failed', e)
    } finally {
      setSharing(false)
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t.totals.sendTitle}
      subtitle={qr ? t.totals.withQrSubtitle : write === myMessage ? t.totals.mineSubtitle : t.totals.sendSubtitle}
      footer={
        <View style={styles.footer}>
          {hasMaths ? (
            <View style={styles.mathsRow}>
              <View style={styles.flex}>
                <AppText variant="label">{t.totals.showMaths}</AppText>
                <AppText variant="caption">{t.totals.showMathsHint}</AppText>
              </View>
              <Toggle value={maths} onValueChange={changeMaths} accessibilityLabel={t.totals.showMaths} />
            </View>
          ) : null}
          {qr && pastesMessage ? <AppText variant="caption">{t.totals.pasteNote}</AppText> : null}
          <Button title={t.totals.send} icon={<SendIcon color={theme.onPrimary} />} onPress={send} loading={sharing} />
        </View>
      }>
      {myMessage ? (
        <View style={styles.who}>
          <Segmented
            stretch
            accessibilityLabel={t.totals.whoToShow}
            options={[
              { value: 'me', label: t.totals.justMe },
              { value: 'everyone', label: t.totals.everyone },
            ]}
            value={who}
            onChange={setWho}
          />
        </View>
      ) : null}
      <View style={[styles.bubble, { backgroundColor: theme.background, borderColor: theme.hairline }]}>
        <AppText variant="body" style={styles.message} selectable>
          {text}
        </AppText>
        {qr ? (
          <>
            <View style={[styles.qrFrame, { borderColor: theme.border }]}>
              <QrCode value={qr.payload} size={176} accessibilityLabel={t.totals.qrA11y(name)} />
            </View>
            <AppText variant="caption" style={styles.center}>
              {t.totals.qrNoAmount}
            </AppText>
          </>
        ) : null}
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  who: { marginBottom: Spacing.three - 4 },
  footer: { gap: Spacing.three - 4 },
  mathsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4 },
  bubble: { borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three - 4, gap: Spacing.three - 4 },
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
