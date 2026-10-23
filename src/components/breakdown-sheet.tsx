import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { Avatar } from '@/components/chip'
import { ChevronDownIcon } from '@/components/icons'
import { Sheet } from '@/components/sheet'
import { AppText } from '@/components/ui'
import { Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import type { SplitResult } from '@/lib/split'

export interface BreakdownPerson {
  id: string
  name: string
  color: string
  result: SplitResult
  /** Their part of each item, like "Tom yum goong · ⅓". */
  items: { label: string; amount: number }[]
}

/** Everyone's total and what it's made of, pulled up from the split screen's footer. */
export function BreakdownSheet({
  visible,
  onClose,
  total,
  people,
  unassigned,
  servicePercent,
  taxPercent,
  money,
  footer,
}: {
  visible: boolean
  onClose: () => void
  total: number
  people: BreakdownPerson[]
  unassigned: { items: number; amount: number }
  servicePercent: number
  taxPercent: number
  money: (amount: number) => string
  footer: ReactNode
}) {
  const theme = useTheme()
  const [open, setOpen] = useState<string | null>(people[0]?.id ?? null)

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Breakdown"
      right={<AppText variant="muted">{money(total)}</AppText>}
      footer={footer}>
      {people.map((person) => {
        const expanded = open === person.id
        const { result } = person
        const lines = [
          ...person.items,
          ...(result.service ? [{ label: `Service ${servicePercent}%`, amount: result.service }] : []),
          ...(result.tax ? [{ label: `VAT ${taxPercent}%`, amount: result.tax }] : []),
          ...(Math.abs(result.rounding) > 0.001 ? [{ label: 'Rounding', amount: result.rounding }] : []),
        ]
        return (
          <View key={person.id} style={[styles.person, { backgroundColor: theme.backgroundElement }]}>
            <Pressable
              onPress={() => setOpen(expanded ? null : person.id)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={`${person.name}, ${money(result.total)}`}
              style={styles.personRow}>
              <Avatar name={person.name} color={person.color} size={32} />
              <View style={styles.flex}>
                <AppText variant="heading">{person.name}</AppText>
                {!expanded && (
                  <AppText variant="caption">
                    {person.items.length} item{person.items.length === 1 ? '' : 's'}
                  </AppText>
                )}
              </View>
              <AppText variant="heading" style={styles.amount}>
                {money(result.total)}
              </AppText>
              <ChevronDownIcon color={theme.textSecondary} up={expanded} />
            </Pressable>
            {expanded && (
              <View style={styles.lines}>
                {lines.length === 0 ? (
                  <AppText variant="caption">Nothing yet</AppText>
                ) : (
                  lines.map((line, index) => (
                    <View key={`${line.label}-${index}`} style={styles.line}>
                      <AppText variant="muted" style={styles.flex} numberOfLines={1}>
                        {line.label}
                      </AppText>
                      <AppText variant="muted" style={styles.amount}>
                        {money(line.amount)}
                      </AppText>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        )
      })}
      {unassigned.amount >= 0.005 && (
        <View style={[styles.unassigned, { borderColor: theme.warning, backgroundColor: theme.warningSoft }]}>
          <AppText variant="label" style={[styles.flex, { color: theme.warning }]}>
            Not assigned · {unassigned.items} item{unassigned.items === 1 ? '' : 's'}
          </AppText>
          <AppText variant="label" style={[styles.amount, { color: theme.warning }]}>
            {money(unassigned.amount)}
          </AppText>
        </View>
      )}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  amount: { fontVariant: ['tabular-nums'] },
  person: { borderRadius: Radius.large, overflow: 'hidden' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4, padding: Spacing.three - 2 },
  lines: { gap: Spacing.one + 2, paddingLeft: Spacing.three - 2 + 32 + Spacing.three - 4, paddingRight: Spacing.three, paddingBottom: Spacing.three },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  unassigned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.large,
    padding: Spacing.three - 2,
  },
})
