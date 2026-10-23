import { Pressable, StyleSheet, View } from 'react-native'

import { Avatar } from '@/components/chip'
import { AppText, Button } from '@/components/ui'
import { Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

/** The biggest amount someone still owes you, with a Remind button. */
export function WaitingCard({
  amount,
  name,
  color,
  billName,
  onOpen,
  onRemind,
}: {
  amount: string
  name: string
  color: string
  billName: string
  onOpen: () => void
  onRemind: () => void
}) {
  const theme = useTheme()
  // Tapping the card opens the bill; Remind sits beside it rather than inside, as a button can't hold another.
  return (
    <View style={[styles.waiting, { backgroundColor: theme.surface }]}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Waiting to be paid back, ${amount}, ${name} from ${billName}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        <AppText variant="caption" style={styles.label}>
          Waiting to be paid back
        </AppText>
        <AppText style={[styles.big, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {amount}
        </AppText>
      </Pressable>
      <View style={styles.who}>
        <Pressable
          onPress={onOpen}
          accessible={false}
          style={({ pressed }) => [styles.whoTap, { opacity: pressed ? 0.7 : 1 }]}>
          <Avatar name={name} color={color} size={30} />
          <AppText variant="muted" numberOfLines={1} style={styles.whoText}>
            {name} · from {billName}
          </AppText>
        </Pressable>
        <Button title="Remind" variant="secondary" size="small" onPress={onRemind} style={styles.remind} />
      </View>
    </View>
  )
}

/** How many bills this month and what they came to. */
export function MonthCard({ month, amount, count }: { month: string; amount: string; count: string }) {
  const theme = useTheme()
  return (
    <View style={[styles.small, { backgroundColor: theme.surface }]}>
      <AppText variant="caption" style={styles.label}>
        {month}
      </AppText>
      <AppText style={[styles.medium, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {amount}
      </AppText>
      <AppText variant="caption">{count}</AppText>
    </View>
  )
}

/** Bills with items nobody has been given yet. */
export function ToSplitCard({ count, onPress }: { count: string; onPress: () => void }) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Not split yet, ${count}`}
      accessibilityHint="Opens the bills to finish"
      style={({ pressed }) => [
        styles.small,
        styles.toSplit,
        { backgroundColor: theme.warningSoft, borderColor: `${theme.warning}33`, opacity: pressed ? 0.85 : 1 },
      ]}>
      <AppText variant="caption" style={[styles.label, { color: theme.warning }]}>
        Not split yet
      </AppText>
      <AppText style={[styles.medium, { color: theme.warning }]}>{count}</AppText>
      <AppText variant="caption" style={{ color: theme.warning }}>
        Tap to finish
      </AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  label: { fontWeight: '600' },
  waiting: { borderRadius: Radius.large + 6, paddingHorizontal: Spacing.three + 4, paddingVertical: Spacing.three + 2 },
  big: { fontSize: 36, lineHeight: 42, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  who: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2, marginTop: Spacing.three - 4 },
  whoTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2 },
  whoText: { flexShrink: 1, fontSize: 14 },
  remind: { minHeight: 40, paddingHorizontal: Spacing.three },
  small: { flex: 1, borderRadius: Radius.large + 4, paddingHorizontal: Spacing.three - 1, paddingVertical: Spacing.three - 4 },
  toSplit: { borderWidth: 1 },
  medium: { fontSize: 20, lineHeight: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
})
