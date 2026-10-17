import { Pressable, ScrollView, StyleSheet, View } from 'react-native'

import { Avatar } from '@/components/chip'
import { CheckIcon } from '@/components/icons'
import { AppText, ProgressBar } from '@/components/ui'
import { Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import type { Money, PersonView } from '@/lib/split-view'

export interface PersonCard extends PersonView {
  total: number
  paidBack: boolean
}

/**
 * One card per person with what they owe, then a "+ Add" card. The row runs
 * edge to edge and scrolls sideways when there are many.
 */
export function PersonCards({
  people,
  openId,
  billTotal,
  money,
  onToggle,
  onAdd,
}: {
  people: PersonCard[]
  /** The card that is open, showing the person's details below. */
  openId: string | null
  billTotal: number
  money: Money
  onToggle: (personId: string) => void
  onAdd: () => void
}) {
  const theme = useTheme()
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.cards}>
      {people.map((person) => {
        const open = openId === person.id
        return (
          <Pressable
            key={person.id}
            onPress={() => onToggle(person.id)}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={`${person.name}, ${money(person.total)}${person.paidBack ? ', paid back' : ''}`}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: theme.surface, borderColor: open ? person.color : 'transparent', opacity: pressed ? 0.85 : 1 },
            ]}>
            <View style={styles.top}>
              <Avatar name={person.name} color={person.color} size={24} />
              <AppText variant="caption" numberOfLines={1} style={[styles.shrink, styles.name]}>
                {person.name}
              </AppText>
              {person.paidBack && <CheckIcon color={theme.success} size={14} weight={2} />}
            </View>
            <AppText variant="heading" style={styles.amount} numberOfLines={1}>
              {money(person.total)}
            </AppText>
            <ProgressBar value={billTotal > 0 ? person.total / billTotal : 0} color={person.color} />
          </Pressable>
        )
      })}
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel="Add people"
        style={({ pressed }) => [styles.card, styles.addCard, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}>
        <View style={[styles.addIcon, { backgroundColor: theme.primarySoft }]}>
          <AppText variant="heading" style={[styles.addPlus, { color: theme.primary }]}>
            +
          </AppText>
        </View>
        <AppText variant="label" style={{ color: theme.primary }}>
          Add
        </AppText>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1 },
  name: { fontWeight: '600' },
  scroll: { marginHorizontal: -Spacing.three, flexGrow: 0 },
  cards: { flexGrow: 1, gap: Spacing.two, paddingHorizontal: Spacing.three },
  card: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 108,
    gap: Spacing.one + 2,
    borderWidth: 1.5,
    borderRadius: Radius.large,
    padding: Spacing.three - 4,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  amount: { fontVariant: ['tabular-nums'], fontSize: 20, lineHeight: 24, fontWeight: '700' },
  addCard: { borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  addPlus: { fontSize: 22, lineHeight: 26, fontWeight: '500' },
})
