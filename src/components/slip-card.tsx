import { Image } from 'expo-image'
import { StyleSheet, View } from 'react-native'

import { CheckIcon, ImageIcon, ReceiptIcon } from '@/components/icons'
import { AppText, Button, Card } from '@/components/ui'
import { Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'

/**
 * On the friend link, once you owe someone: add a screenshot of the transfer
 * you made. Only the bill's owner can see it, and they still mark you paid.
 */
export function SlipCard({
  payerName,
  ownerName,
  sent,
  preview,
  busy,
  onAdd,
  onRemove,
}: {
  payerName: string
  /** Who can see the slip: the person who shared the bill. */
  ownerName: string
  sent: boolean
  /** The photo you just sent, while this page is open. The page can't load it back later. */
  preview: string | null
  busy: boolean
  onAdd: () => void
  onRemove: () => void
}) {
  const theme = useTheme()
  const { common, pick: t } = useT()

  if (!sent) {
    return (
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.badge, { backgroundColor: theme.primarySoft }]}>
            <ReceiptIcon color={theme.primary} size={20} />
          </View>
          <View style={styles.flex}>
            <AppText variant="heading">{t.slipTitle(payerName)}</AppText>
            <AppText variant="caption">{t.slipHint(ownerName)}</AppText>
          </View>
        </View>
        <Button
          title={t.addSlip}
          variant="secondary"
          icon={<ImageIcon color={theme.text} size={16} />}
          onPress={onAdd}
          loading={busy}
        />
      </Card>
    )
  }

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        {preview ? (
          <Image source={{ uri: preview }} style={[styles.thumb, { borderColor: theme.border }]} contentFit="cover" />
        ) : (
          <View style={[styles.badge, { backgroundColor: theme.successSoft }]}>
            <CheckIcon color={theme.success} size={18} weight={2.4} />
          </View>
        )}
        <View style={styles.flex}>
          <AppText variant="heading" style={{ color: theme.success }}>
            {t.slipSent}
          </AppText>
          <AppText variant="caption">{t.slipSentHint(ownerName)}</AppText>
        </View>
      </View>
      <View style={styles.actions}>
        <Button title={t.replaceSlip} variant="secondary" size="small" onPress={onAdd} loading={busy} style={styles.flex} />
        <Button title={common.remove} variant="danger" size="small" onPress={onRemove} disabled={busy} style={styles.flex} />
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: Spacing.three - 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4 },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 40, height: 56, borderRadius: Radius.small, borderWidth: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', gap: Spacing.two },
})
