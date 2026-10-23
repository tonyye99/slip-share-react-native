import { Pressable, StyleSheet, View } from 'react-native'

import { ChevronRight, PeopleIcon, PersonIcon } from '@/components/icons'
import { justSwiped, SwipeActions } from '@/components/swipe-actions'
import { AppText } from '@/components/ui'
import { Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'
import { bothNames } from '@/lib/names'
import type { Item, ItemStatus, Money } from '@/lib/split-view'

/**
 * One line of "Who had what": the item and how many had it on the left, the
 * price and what each pays on the right. Tapping it or swiping it right opens
 * "Who had this?".
 */
export function ItemRow({
  item,
  showEnglish,
  had,
  status,
  alone,
  divider,
  money,
  onOpen,
}: {
  item: Item
  showEnglish: boolean
  /** Ids of the people who had it. */
  had: string[]
  status: ItemStatus
  /** Only you on the bill, so there is nobody to pick. */
  alone: boolean
  /** Draw a line above this row. */
  divider: boolean
  money: Money
  onOpen: () => void
}) {
  const theme = useTheme()
  const t = useT()
  const lineTotal = item.qty * item.unit_price
  const names = bothNames(item.name, item.name_en, showEnglish)
  const nobody = had.length === 0
  const who = nobody ? t.split.noOneYet : t.common.people(had.length)
  const whoColor = nobody ? theme.warning : theme.textSecondary
  // On your own there's no one to pick, so the line just says what it is.
  const caption = alone
    ? [names.other, item.qty !== 1 ? `${item.qty} × ${money(item.unit_price)}` : null].filter(Boolean).join(' · ')
    : null

  const row = (
    <Pressable
      // A tap that ends a swipe isn't a tap.
      onPress={() => !justSwiped() && onOpen()}
      disabled={alone}
      accessibilityRole="button"
      accessibilityLabel={[names.main, money(lineTotal), alone ? null : who, alone || nobody ? null : status.text]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint={alone ? undefined : t.split.chooseWhoHadIt}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed && !alone ? theme.backgroundElement : theme.surface },
        divider && { borderTopColor: theme.hairline, borderTopWidth: StyleSheet.hairlineWidth },
      ]}>
      <View style={styles.left}>
        <AppText variant="heading" numberOfLines={2}>
          {names.main}
        </AppText>
        {alone ? (
          caption ? (
            <AppText variant="caption">{caption}</AppText>
          ) : null
        ) : (
          <View style={styles.who}>
            <View style={styles.flip}>
              <PeopleIcon color={whoColor} size={11} weight={1.6} />
            </View>
            <AppText variant="muted" style={[styles.whoText, { color: whoColor }]}>
              {who}
            </AppText>
          </View>
        )}
      </View>
      <View style={styles.right}>
        <AppText variant="heading" style={styles.amount}>
          {money(lineTotal)}
        </AppText>
        {!alone && !nobody && (
          <AppText variant="muted" style={[styles.status, status.warn && { color: theme.warning, fontWeight: '600' }]}>
            {status.text}
          </AppText>
        )}
      </View>
      {!alone && <ChevronRight color={theme.textSecondary} />}
    </Pressable>
  )

  if (alone) return row
  return (
    <SwipeActions
      start={{
        label: t.split.pickWho,
        color: theme.primary,
        textColor: theme.onPrimary,
        icon: <PersonIcon color={theme.onPrimary} size={18} />,
        onAction: onOpen,
      }}>
      {row}
    </SwipeActions>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.three + 2,
    paddingVertical: Spacing.three - 3,
  },
  left: { flex: 1 },
  who: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two - 1 },
  whoText: { fontWeight: '600' },
  // The bigger figure in front, on the left.
  flip: { transform: [{ scaleX: -1 }] },
  right: { alignItems: 'flex-end', maxWidth: 150, marginRight: Spacing.one + 1 },
  amount: { fontVariant: ['tabular-nums'] },
  status: { textAlign: 'right', fontVariant: ['tabular-nums'] },
})
