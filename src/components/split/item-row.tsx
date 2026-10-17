import { Pressable, StyleSheet, View } from 'react-native'

import { InitialChip } from '@/components/chip'
import { PersonIcon } from '@/components/icons'
import { justSwiped, SwipeActions } from '@/components/swipe-actions'
import { AppText } from '@/components/ui'
import { Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { bothNames } from '@/lib/names'
import type { Item, ItemStatus, Money, PersonView } from '@/lib/split-view'

/**
 * One line of "Who had what": the item, everyone's initials to tap, an All
 * pill, and what the line says about who had it. Tapping the item or swiping
 * it right opens "Who had this?".
 */
export function ItemRow({
  item,
  showEnglish,
  people,
  had,
  status,
  alone,
  divider,
  money,
  onOpen,
  onTogglePerson,
  onToggleEveryone,
}: {
  item: Item
  showEnglish: boolean
  people: PersonView[]
  /** Ids of the people who had it. */
  had: string[]
  status: ItemStatus
  /** Only you on the bill, so there is nobody to pick. */
  alone: boolean
  /** Draw a line above this row. */
  divider: boolean
  money: Money
  onOpen: () => void
  onTogglePerson: (personId: string) => void
  onToggleEveryone: () => void
}) {
  const theme = useTheme()
  const lineTotal = item.qty * item.unit_price
  const names = bothNames(item.name, item.name_en, showEnglish)
  const everyoneOn = people.every((person) => had.includes(person.id))
  const caption = [names.other, item.qty !== 1 ? `${item.qty} × ${money(item.unit_price)}` : null].filter(Boolean).join(' · ')
  // A tap that ends a swipe isn't a tap.
  const tap = (run: () => void) => () => !justSwiped() && run()

  const row = (
    <View
      style={[
        styles.row,
        { backgroundColor: theme.surface },
        divider && { borderTopColor: theme.hairline, borderTopWidth: StyleSheet.hairlineWidth },
      ]}>
      <Pressable
        onPress={tap(onOpen)}
        disabled={alone}
        accessibilityRole="button"
        accessibilityLabel={`${names.main}, ${money(lineTotal)}`}
        accessibilityHint={alone ? undefined : 'Choose who had it'}
        style={styles.top}>
        <View style={styles.flex}>
          <AppText variant="heading">{names.main}</AppText>
          {caption ? <AppText variant="caption">{caption}</AppText> : null}
        </View>
        <AppText variant="heading" style={styles.amount}>
          {money(lineTotal)}
        </AppText>
      </Pressable>
      {!alone && (
        <View style={styles.chipRow}>
          <View style={styles.initials}>
            {people.map((person) => (
              <InitialChip
                key={person.id}
                name={person.name}
                color={person.color}
                selected={had.includes(person.id)}
                onPress={tap(() => onTogglePerson(person.id))}
                accessibilityLabel={`${person.name} had ${names.main}`}
              />
            ))}
            <Pressable
              onPress={tap(onToggleEveryone)}
              hitSlop={2}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: everyoneOn }}
              accessibilityLabel={`Everyone shared ${names.main}`}
              style={({ pressed }) => [
                styles.allPill,
                { backgroundColor: everyoneOn ? theme.text : theme.backgroundElement, opacity: pressed ? 0.8 : 1 },
              ]}>
              <AppText variant="label" style={{ color: everyoneOn ? theme.background : theme.text }}>
                All
              </AppText>
            </Pressable>
          </View>
          <Pressable onPress={tap(onOpen)} hitSlop={8} style={styles.status} accessibilityElementsHidden>
            <AppText variant="caption" style={[styles.statusText, status.warn && { color: theme.warning, fontWeight: '600' }]}>
              {status.text}
            </AppText>
          </Pressable>
        </View>
      )}
    </View>
  )

  if (alone) return row
  return (
    <SwipeActions
      start={{
        label: 'Pick who',
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
  flex: { flex: 1 },
  amount: { fontVariant: ['tabular-nums'] },
  row: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three - 2, gap: Spacing.two + 2 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  initials: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two + 2, flexShrink: 1 },
  allPill: {
    minWidth: 44,
    height: 40,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three - 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: { marginLeft: 'auto', maxWidth: 130 },
  statusText: { textAlign: 'right' },
})
