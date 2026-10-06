import { Pressable, StyleSheet, View } from 'react-native'

import { AppText } from '@/components/ui'
import { Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

const MIN_PEOPLE = 1
const MAX_PEOPLE = 99

/** "Split between N people" control used per selected item. */
export function ShareStepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const theme = useTheme()
  const changeBy = (delta: number) => onChange(Math.min(MAX_PEOPLE, Math.max(MIN_PEOPLE, value + delta)))

  const stepButton = (label: string, delta: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={delta > 0 ? 'More people' : 'Fewer people'}
      disabled={disabled}
      onPress={() => changeBy(delta)}
      hitSlop={8}
      style={[styles.button, { backgroundColor: theme.backgroundSelected, opacity: disabled ? 0.4 : 1 }]}>
      <AppText variant="heading">{label}</AppText>
    </Pressable>
  )

  return (
    <View style={styles.container}>
      <AppText variant="muted">Split</AppText>
      {stepButton('−', -1, value <= MIN_PEOPLE)}
      <AppText variant="label" style={styles.value} accessibilityLabel={`${value} people`}>
        {value}
      </AppText>
      {stepButton('+', 1, value >= MAX_PEOPLE)}
      <AppText variant="muted">{value === 1 ? 'person' : 'people'}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  button: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  value: { minWidth: 24, textAlign: 'center' },
})
