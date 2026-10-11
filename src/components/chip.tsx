import { Pressable, StyleSheet } from 'react-native'

import { AppText } from '@/components/ui'
import { Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

/** A pill you tap to pick a name, or to toggle one on and off. */
export function Chip({
  label,
  selected = false,
  onPress,
  disabled,
  role = 'checkbox',
  accessibilityLabel,
}: {
  label: string
  selected?: boolean
  onPress: () => void
  disabled?: boolean
  role?: 'checkbox' | 'radio' | 'button'
  accessibilityLabel?: string
}) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={role === 'radio' ? { selected, disabled } : role === 'checkbox' ? { checked: selected, disabled } : { disabled }}
      style={[
        styles.chip,
        {
          borderColor: theme.primary,
          backgroundColor: selected ? theme.primary : 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
      ]}>
      <AppText variant="label" style={{ color: selected ? theme.onPrimary : theme.primary }}>
        {label}
      </AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    minHeight: 32,
    justifyContent: 'center',
  },
})
