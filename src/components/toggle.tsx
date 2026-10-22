import { Platform, Pressable, StyleSheet, Switch, View, type ViewStyle } from 'react-native'

import { useTheme } from '@/hooks/use-theme'

// The browser's switch has no gap around its knob, so the website draws one like the iPhone's.
const slide = Platform.OS === 'web' ? ({ transitionProperty: 'left', transitionDuration: '150ms' } as unknown as ViewStyle) : null

/** An on/off switch: the phone's own on iPhone and Android, drawn to match on the website. */
export function Toggle({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
}: {
  value: boolean
  onValueChange: (value: boolean) => void
  disabled?: boolean
  accessibilityLabel: string
}) {
  const theme = useTheme()
  if (Platform.OS !== 'web') {
    return (
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: theme.backgroundSelected, true: theme.success }}
        ios_backgroundColor={theme.backgroundSelected}
        thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
        accessibilityLabel={accessibilityLabel}
      />
    )
  }
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      role="switch"
      aria-checked={value}
      aria-disabled={disabled}
      aria-label={accessibilityLabel}
      style={[styles.track, { backgroundColor: value ? theme.success : theme.backgroundSelected, opacity: disabled ? 0.5 : 1 }]}>
      <View style={[styles.knob, slide, { left: value ? 22 : 2 }]} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  track: { width: 51, height: 31, borderRadius: 16 },
  knob: {
    position: 'absolute',
    top: 2,
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
  },
})
