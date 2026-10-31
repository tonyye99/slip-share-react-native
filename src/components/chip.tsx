import { Pressable, StyleSheet, View } from 'react-native'

import { AppText } from '@/components/ui'
import { Colors, PersonColors, PersonColorsDark, Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

type Role = 'checkbox' | 'radio' | 'button'

const stateFor = (role: Role, selected: boolean, disabled?: boolean) =>
  role === 'radio' ? { selected, disabled } : role === 'checkbox' ? { checked: selected, disabled } : { disabled }

/** Each person keeps one colour, picked by their place on the bill, and a lighter one in dark mode. */
export function usePersonColor() {
  const palette = useTheme() === Colors.dark ? PersonColorsDark : PersonColors
  return (index: number) => palette[Math.max(0, index) % palette.length]
}

// Thai vowels written before the consonant (เ แ โ ใ ไ) are skipped, so เบน shows บ.
const LEADING_VOWEL = /[\u0E40-\u0E44]/
const initialOf = (name: string) => {
  const letters = Array.from(name.trim())
  return (letters.find((letter) => !LEADING_VOWEL.test(letter)) ?? letters[0] ?? '?').toUpperCase()
}

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
      <AppText style={{ color: pale ? color : theme.onPerson, fontSize: size * 0.46, lineHeight: size * 0.6, fontWeight: '600' }}>
        {initialOf(name)}
      </AppText>
    </View>
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
  chip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    minHeight: 40,
    justifyContent: 'center',
  },
})
