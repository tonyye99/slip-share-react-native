import { Pressable, StyleSheet, View } from 'react-native'

import { CheckIcon } from '@/components/icons'
import { AppText, Card, ProgressBar } from '@/components/ui'
import { Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import type { Money } from '@/lib/split-view'

/** The bill total at the top, how much of it is assigned, and how much is paid back. */
export function BillSummary({
  total,
  caption,
  progress,
  settled,
  paidBack,
  owedBack,
  money,
  onShowSettled,
}: {
  total: number
  /** Like "Paid by you · incl. service and VAT". */
  caption: string
  /** How far assigning has got. Left out while you're the only one on the bill. */
  progress: { assignedItems: number; itemCount: number; left: number; share: number } | null
  settled: boolean
  paidBack: number
  owedBack: number
  money: Money
  onShowSettled: () => void
}) {
  const theme = useTheme()
  const hasLeft = !!progress && Math.abs(progress.left) >= 0.005
  return (
    <Card style={styles.summary}>
      <View style={styles.top}>
        <AppText variant="caption" style={[styles.label, { color: theme.text }]}>
          Bill total
        </AppText>
        <AppText variant="caption" numberOfLines={1} style={styles.shrink}>
          {caption}
        </AppText>
      </View>
      <AppText style={[styles.total, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {money(total)}
      </AppText>
      {progress && (
        <View style={styles.assigned}>
          <View style={styles.assignedRow}>
            <AppText variant="caption" style={[styles.assignedText, { color: hasLeft ? theme.text : theme.success }]}>
              {hasLeft
                ? `${progress.assignedItems} of ${progress.itemCount} items assigned`
                : `All ${progress.itemCount} items assigned`}
            </AppText>
            <AppText variant="caption" style={styles.amount}>
              {hasLeft ? `${money(progress.left)} left` : 'Ready to send'}
            </AppText>
          </View>
          <ProgressBar value={progress.share} color={hasLeft ? theme.primary : theme.success} />
        </View>
      )}
      {settled ? (
        <Pressable onPress={onShowSettled} accessibilityRole="button" style={styles.settledLink}>
          <CheckIcon color={theme.success} size={14} weight={2} />
          <AppText variant="caption" style={{ color: theme.success, fontWeight: '700' }}>
            All settled
          </AppText>
        </Pressable>
      ) : paidBack > 0 ? (
        <AppText variant="caption" style={{ color: theme.success, fontWeight: '600' }}>
          {money(paidBack)} of {money(owedBack)} paid back
        </AppText>
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1 },
  amount: { fontVariant: ['tabular-nums'] },
  summary: { gap: Spacing.one, padding: Spacing.three + 4, borderRadius: Radius.large + 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  label: { flex: 1, fontWeight: '600' },
  total: { fontSize: 36, lineHeight: 44, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  assigned: { gap: Spacing.two, marginTop: Spacing.two },
  assignedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  assignedText: { flex: 1, fontWeight: '700' },
  settledLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, alignSelf: 'flex-start', marginTop: 2 },
})
