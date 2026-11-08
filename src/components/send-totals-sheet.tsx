import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View, type ViewInstance } from 'react-native'

import { CopyIcon, SendIcon } from '@/components/icons'
import { Sheet } from '@/components/sheet'
import { Toggle } from '@/components/toggle'
import { TotalsCard } from '@/components/totals-card'
import { AppText, Button, Segmented } from '@/components/ui'
import { Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'
import { track } from '@/lib/analytics'
import { copyText } from '@/lib/copy'
import { formatPromptPay } from '@/lib/promptpay'
import { pastesMessage, shareWithQr } from '@/lib/qr-picture'
import { secureStorage } from '@/lib/secure-storage'
import { shareText } from '@/lib/share-text'

const MATHS_KEY = 'slipshare.totalsMaths'

export function SendTotalsSheet({
  visible,
  onClose,
  message,
  myMessage,
  qr,
  onSentMine,
}: {
  visible: boolean
  onClose: () => void
  message: ((maths: boolean) => string) | null
  myMessage: ((maths: boolean) => string) | null
  qr: { payload: string; id: string | null; name: string | null } | null
  onSentMine: () => void
}) {
  const theme = useTheme()
  const t = useT()
  const [sharing, setSharing] = useState(false)
  const card = useRef<ViewInstance>(null)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current)
  }, [])
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
  const write = (myMessage && (who === 'me' || !message) ? myMessage : message) ?? (() => '')
  const text = visible ? write(maths) : ''
  const hasMaths = visible && write(true) !== write(false)
  const name = qr?.name ?? t.pay.promptpay
  const caption = qr?.id ? [name, t.pay.promptpayNumber(formatPromptPay(qr.id))] : [name, t.pay.promptpay]

  const copy = async () => {
    if (!(await copyText(text))) return
    track('totals_copied')
    setCopied(true)
    if (copyTimer.current) clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(false), 2000)
  }

  const send = async () => {
    setSharing(true)
    try {
      if (qr) {
        const sent = await shareWithQr(text, qr.payload, {
          card,
          caption,
          note: t.totals.qrNoAmount,
          fileName: 'SlipShare-totals.png',
          title: t.totals.sendTitle,
        })
        if (!sent) return
        track('totals_qr_sent')
      } else if (!(await shareText(text))) {
        return
      }
      const justMe = write === myMessage
      track('totals_sent', { maths, just_me: justMe })
      onClose()
      if (justMe) onSentMine()
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
      title={write === myMessage ? t.split.sendMyShare : t.totals.sendTitle}
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
          <View style={styles.buttons}>
            <Button
              title={copied ? t.common.copied : t.totals.copyText}
              variant="secondary"
              icon={<CopyIcon color={theme.text} size={16} />}
              onPress={copy}
              style={styles.flex}
            />
            <Button
              title={t.totals.send}
              icon={<SendIcon color={theme.onPrimary} />}
              onPress={send}
              loading={sharing}
              style={styles.flex}
            />
          </View>
        </View>
      }>
      {myMessage && message ? (
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
      {qr ? (
        <TotalsCard
          cardRef={card}
          message={text}
          qr={qr.payload}
          caption={caption}
          note={t.totals.qrNoAmount}
          qrLabel={t.totals.qrA11y(name)}
        />
      ) : (
        <View style={[styles.bubble, { backgroundColor: theme.background, borderColor: theme.hairline }]}>
          <AppText variant="body" style={styles.message} selectable>
            {text}
          </AppText>
        </View>
      )}
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
  buttons: { flexDirection: 'row', gap: Spacing.two },
})
