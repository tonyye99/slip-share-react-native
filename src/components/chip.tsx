import { Pressable, StyleSheet, View } from 'react-native'

import { AppText } from '@/components/ui'
import { Colors, PersonColors, Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

type Role = 'checkbox' | 'radio' | 'button'

const stateFor = (role: Role, selected: boolean, disabled?: boolean) =>
  role === 'radio' ? { selected, disabled } : role === 'checkbox' ? { checked: selected, disabled } : { disabled }

/** Each person keeps one colour, picked by their place on the bill. */
export const personColor = (index: number) => PersonColors[Math.max(0, index) % PersonColors.length]

const initialOf = (name: string) => (Array.from(name.trim())[0] ?? '?').toUpperCase()

/** A round initial in the person's colour. `soft` is a pale circle with a coloured letter. */
export function Avatar({ name, color, size = 28, soft }: { name: string; color: string; size?: number; soft?: boolean }) {
  const theme = useTheme()
  // Pale circles lose contrast on a dark page, so dark mode always fills them.
  const pale = soft && theme === Colors.light
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: pale ? `${color}1F` : color },
      ]}>
      <AppText style={{ color: pale ? color : '#FFFFFF', fontSize: size * 0.46, lineHeight: size * 0.6, fontWeight: '600' }}>
        {initialOf(name)}
      </AppText>
    </View>
  )
}

/** A person's name you tap on or off. On, it fills with their colour and shows a tick. */
export function PersonChip({
  name,
  color,
  selected = false,
  onPress,
  disabled,
  role = 'checkbox',
  accessibilityLabel,
}: {
  name: string
  color: string
  selected?: boolean
  onPress: () => void
  disabled?: boolean
  role?: Role
  accessibilityLabel?: string
}) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? name}
      accessibilityState={stateFor(role, selected, disabled)}
      style={({ pressed }) => [
        styles.personChip,
        selected
          ? { backgroundColor: color, borderColor: color }
          : { backgroundColor: theme.surface, borderColor: theme.border },
        { opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}>
      {selected ? (
        <View style={[styles.tick, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
          <AppText style={styles.tickText}>✓</AppText>
        </View>
      ) : (
        <Avatar name={name} color={color} size={26} soft />
      )}
      <AppText variant="label" style={{ color: selected ? '#FFFFFF' : theme.text }}>
        {name}
      </AppText>
    </Pressable>
  )
}

/** A plain pill: "+ Anna" to add a recent name, or a dashed "Everyone". */
export function Chip({
  label,
  selected = false,
  onPress,
  disabled,
  dashed,
  role = 'checkbox',
  accessibilityLabel,
}: {
  label: string
  selected?: boolean
  onPress: () => void
  disabled?: boolean
  dashed?: boolean
  role?: Role
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
      accessibilityState={stateFor(role, selected, disabled)}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? { backgroundColor: theme.text, borderColor: theme.text }
          : { backgroundColor: theme.surface, borderColor: theme.border },
        dashed && !selected && { borderStyle: 'dashed', borderColor: theme.textSecondary },
        { opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}>
      <AppText variant="label" style={{ color: selected ? theme.background : theme.text }}>
        {label}
      </AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  personChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingLeft: Spacing.one + 2,
    paddingRight: Spacing.three,
    minHeight: 40,
  },
  tick: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tickText: { color: '#FFFFFF', fontSize: 14, lineHeight: 18, fontWeight: '700' },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    minHeight: 40,
    justifyContent: 'center',
  },
})
