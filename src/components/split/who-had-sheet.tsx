import { Pressable, StyleSheet, View } from 'react-native'

import { Avatar } from '@/components/chip'
import { CheckIcon } from '@/components/icons'
import { Sheet } from '@/components/sheet'
import { AppText, Button, Stepper } from '@/components/ui'
import { Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'
import { bothNames } from '@/lib/names'
import { isCountable } from '@/lib/split'
import type { Item, ItemStatus, Money, PersonView } from '@/lib/split-view'

/** "Who had this?" for one item: tick people, or − 1 + on lines like 2 × Egg Kim Bab. */
export function WhoHadSheet({
  visible,
  onClose,
  item,
  showEnglish,
  people,
  counts,
  shares,
  status,
  money,
  onToggleEveryone,
  onTogglePerson,
  onSetCount,
}: {
  visible: boolean
  onClose: () => void
  item: Item | undefined
  showEnglish: boolean
  people: PersonView[]
  /** Person id -> how many of the item they had. Everyone on it has a key. */
  counts: Record<string, number>
  /** Person id -> what their part costs. */
  shares: Record<string, number>
  status: ItemStatus
  money: Money
  onToggleEveryone: () => void
  onTogglePerson: (personId: string) => void
  onSetCount: (personId: string, units: number) => void
}) {
  const theme = useTheme()
  const t = useT()
  const names = item ? bothNames(item.name, item.name_en, showEnglish) : null
  const had = Object.keys(counts)
  const everyoneOn = people.every((person) => had.includes(person.id))
  // "Split between 2 · ฿144.50 each"
  const summary =
    had.length > 1 && !status.warn
      ? `${t.split.splitBetween(had.length)}${status.even ? ` · ${status.text}` : ''}`
      : status.text

  return (
    <Sheet
      visible={visible && !!item}
      onClose={onClose}
      title={names?.main}
      subtitle={item && names ? [names.other, `${item.qty} × ${money(item.unit_price)}`].filter(Boolean).join(' · ') : undefined}
      right={
        item ? (
          <AppText variant="title" style={[styles.amount, styles.price]}>
            {money(item.qty * item.unit_price)}
          </AppText>
        ) : null
      }
      footer={
        <View style={styles.footer}>
          <AppText variant="caption" style={[styles.flex, status.warn && { color: theme.warning, fontWeight: '600' }]}>
            {summary}
          </AppText>
          <Button title={t.common.done} onPress={onClose} style={styles.done} />
        </View>
      }>
      {item && names && (
        <>
          <View style={styles.header}>
            <AppText variant="label" style={styles.flex}>
              {t.split.whoHadThis}
            </AppText>
            <Pressable
              onPress={onToggleEveryone}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: everyoneOn }}
              accessibilityLabel={t.split.everyone}
              style={({ pressed }) => [
                styles.everyone,
                { backgroundColor: everyoneOn ? theme.text : theme.backgroundElement, opacity: pressed ? 0.8 : 1 },
              ]}>
              <AppText variant="label" style={{ color: everyoneOn ? theme.background : theme.text }}>
                {t.split.everyone}
              </AppText>
            </Pressable>
          </View>
          {people.map((person) => {
            const on = person.id in counts
            const rowStyle = [
              styles.row,
              on
                ? { backgroundColor: `${person.color}1F`, borderColor: person.color }
                : { backgroundColor: theme.backgroundElement, borderColor: 'transparent' },
            ]
            const nameAndShare = (
              <>
                <Avatar name={person.name} color={person.color} size={32} />
                <AppText variant="label" numberOfLines={1} style={styles.flex}>
                  {person.name}
                </AppText>
                {on && (
                  <AppText variant="label" style={styles.amount}>
                    {money(shares[person.id] ?? 0)}
                  </AppText>
                )}
              </>
            )
            if (isCountable(item)) {
              return (
                <View key={person.id} style={rowStyle}>
                  {nameAndShare}
                  <Stepper
                    value={counts[person.id] ?? 0}
                    min={0}
                    max={item.qty}
                    onChange={(next) => onSetCount(person.id, next)}
                    label={t.split.countFor(names.main, person.name)}
                  />
                </View>
              )
            }
            return (
              <Pressable
                key={person.id}
                onPress={() => onTogglePerson(person.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={t.split.hadItem(person.name, names.main)}
                style={({ pressed }) => [rowStyle, { opacity: pressed ? 0.85 : 1 }]}>
                {nameAndShare}
                <View
                  style={[
                    styles.checkbox,
                    on
                      ? { backgroundColor: person.color, borderColor: person.color }
                      : { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}>
                  {on && <CheckIcon color={theme.onPerson} size={14} weight={2} />}
                </View>
              </Pressable>
            )
          })}
        </>
      )}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  amount: { fontVariant: ['tabular-nums'] },
  price: { fontSize: 22, lineHeight: 28 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.one, marginBottom: Spacing.one },
  everyone: { borderRadius: Radius.pill, paddingHorizontal: Spacing.three, minHeight: 36, justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    minHeight: 56,
    paddingHorizontal: Spacing.three - 4,
    borderWidth: 1.5,
    borderRadius: Radius.medium + 2,
  },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  done: { paddingHorizontal: Spacing.five },
})
