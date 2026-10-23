import { StyleSheet, View } from 'react-native'

import { ReceiptIcon } from '@/components/icons'
import { SwipeToDelete } from '@/components/swipe-to-delete'
import { AppText, Tag } from '@/components/ui'
import { Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'
import type { BillState } from '@/lib/bills'

/** One bill in "Your bills": a tile in its state's colour, name and date, total and a badge. Swipe left to delete. */
export function BillRow({
  name,
  caption,
  amount,
  state,
  badge,
  first,
  last,
  onOpen,
  onDelete,
}: {
  name: string
  /** Like "Today · 4 items". */
  caption: string
  amount: string
  state: BillState
  badge: string
  first: boolean
  last: boolean
  onOpen: () => void
  onDelete: () => void
}) {
  const theme = useTheme()
  const t = useT()
  const [tint, ink, tone] = {
    'to-split': [theme.warningSoft, theme.warning, 'warning'] as const,
    waiting: [theme.primarySoft, theme.primary, 'primary'] as const,
    settled: [theme.successSoft, theme.success, 'success'] as const,
  }[state]
  return (
    <View
      style={[
        styles.clip,
        first && styles.top,
        last && styles.bottom,
        !first && { borderTopColor: theme.hairline, borderTopWidth: StyleSheet.hairlineWidth },
      ]}>
      <SwipeToDelete flat onPress={onOpen} onDelete={onDelete} deleteLabel={t.home.deleteReceipt}>
        {(pressed) => (
          <View style={[styles.row, { backgroundColor: pressed ? theme.primaryTint : theme.surface }]}>
            <View style={[styles.tile, { backgroundColor: tint }]}>
              <ReceiptIcon color={ink} size={22} />
            </View>
            <View style={styles.flex}>
              <AppText variant="heading" numberOfLines={1}>
                {name}
              </AppText>
              <AppText variant="muted" numberOfLines={1}>
                {caption}
              </AppText>
            </View>
            <View style={styles.right}>
              <AppText variant="heading" style={styles.amount}>
                {amount}
              </AppText>
              <View style={styles.badge}>
                <Tag label={badge} tone={tone} />
              </View>
            </View>
          </View>
        )}
      </SwipeToDelete>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  clip: { overflow: 'hidden' },
  top: { borderTopLeftRadius: Radius.large + 4, borderTopRightRadius: Radius.large + 4 },
  bottom: { borderBottomLeftRadius: Radius.large + 4, borderBottomRightRadius: Radius.large + 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4, paddingHorizontal: Spacing.three - 2, paddingVertical: Spacing.three - 4 },
  tile: { width: 44, height: 44, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center' },
  right: { alignItems: 'flex-end', gap: Spacing.one, flexShrink: 0 },
  amount: { fontVariant: ['tabular-nums'], fontWeight: '700' },
  badge: { alignSelf: 'flex-end' },
})
