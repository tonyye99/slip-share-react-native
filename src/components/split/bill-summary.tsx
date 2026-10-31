import { Pressable, StyleSheet, View } from 'react-native'

import { Avatar } from '@/components/chip'
import { CheckIcon, ChevronDownIcon } from '@/components/icons'
import { AppText, Card, ProgressBar } from '@/components/ui'
import { Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'
import type { Money, PersonView } from '@/lib/split-view'

/** The bill total at the top, who paid, how much of it is assigned, and how much is paid back. */
export function BillSummary({
  total,
  caption,
  payer,
  onChoosePayer,
  progress,
  settled,
  paidBack,
  owedBack,
  money,
  onShowSettled,
}: {
  total: number
  /** Like "incl. service and VAT". */
  caption: string
  /**
   * Who paid, as a button that changes it: "Paid by you" or "Paid by Ben".
   * Left out while you're the only one on the bill.
   */
  payer: { label: string; person: PersonView | null } | null
  onChoosePayer: () => void
  /** How far assigning has got. Left out while you're the only one on the bill. */
  progress: { assignedItems: number; itemCount: number; left: number; share: number } | null
  settled: boolean
  paidBack: number
  owedBack: number
  money: Money
  onShowSettled: () => void
}) {
  const theme = useTheme()
  const t = useT().split
  const hasLeft = !!progress && Math.abs(progress.left) >= 0.005
  return (
    <Card style={styles.summary}>
      <View style={styles.top}>
        <AppText variant="caption" style={styles.label}>
          {t.billTotal}
        </AppText>
        <AppText variant="caption" numberOfLines={1} style={styles.shrink}>
          {caption}
        </AppText>
      </View>
      <AppText style={[styles.total, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {money(total)}
      </AppText>
      {payer && (
        <Pressable
          onPress={onChoosePayer}
          accessibilityRole="button"
          accessibilityLabel={payer.label}
          accessibilityHint={t.changePayer}
          hitSlop={6}
          style={({ pressed }) => [
            styles.payer,
            !payer.person && styles.payerNoAvatar,
            { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
          ]}>
          {payer.person && <Avatar name={payer.person.name} color={payer.person.color} size={22} />}
          <AppText variant="label" numberOfLines={1} style={styles.shrink}>
            {payer.label}
          </AppText>
          <ChevronDownIcon color={theme.textSecondary} />
        </Pressable>
      )}
      {progress && (
        <View style={styles.assigned}>
          <View style={styles.assignedRow}>
            <AppText variant="caption" style={[styles.assignedText, { color: hasLeft ? theme.text : theme.success }]}>
              {hasLeft ? t.itemsAssigned(progress.assignedItems, progress.itemCount) : t.allItemsAssigned(progress.itemCount)}
            </AppText>
            <AppText variant="caption" style={styles.amount}>
              {hasLeft ? t.left(money(progress.left)) : t.readyToSend}
            </AppText>
          </View>
          <ProgressBar value={progress.share} color={hasLeft ? theme.primary : theme.success} />
        </View>
      )}
      {settled ? (
        <Pressable onPress={onShowSettled} accessibilityRole="button" style={styles.settledLink}>
          <CheckIcon color={theme.success} size={14} weight={2} />
          <AppText variant="caption" style={{ color: theme.success, fontWeight: '700' }}>
            {t.allSettled}
          </AppText>
        </Pressable>
      ) : paidBack > 0 ? (
        <AppText variant="caption" style={{ color: theme.success, fontWeight: '600' }}>
          {t.paidBackOf(money(paidBack), money(owedBack))}
        </AppText>
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1 },
  amount: { fontVariant: ['tabular-nums'] },
  summary: { gap: Spacing.one, padding: Spacing.three + 2, borderRadius: Radius.large + 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  label: { flex: 1, fontWeight: '600' },
  total: { fontSize: 36, lineHeight: 40, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  assigned: { gap: Spacing.one + 1, marginTop: Spacing.one + 3 },
  assignedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  assignedText: { flex: 1, fontWeight: '700' },
  payer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two - 2,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: Radius.pill,
    paddingVertical: Spacing.one,
    paddingLeft: Spacing.one,
    paddingRight: Spacing.three - 4,
    marginTop: 2,
  },
  payerNoAvatar: { paddingLeft: Spacing.three - 4, paddingVertical: Spacing.one + 2 },
  settledLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, alignSelf: 'flex-start', marginTop: 2 },
})
