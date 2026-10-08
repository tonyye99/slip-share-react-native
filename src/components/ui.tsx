import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
  type ViewProps,
} from 'react-native'

import { Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

type TextVariant = 'title' | 'heading' | 'body' | 'label' | 'muted' | 'error'

export function AppText({ variant = 'body', style, ...rest }: TextProps & { variant?: TextVariant }) {
  const theme = useTheme()
  const color =
    variant === 'muted' ? theme.textSecondary : variant === 'error' ? theme.danger : theme.text
  return <Text style={[{ color }, textStyles[variant], style]} {...rest} />
}

const textStyles = StyleSheet.create({
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  muted: { fontSize: 14, lineHeight: 20 },
  error: { fontSize: 14, lineHeight: 20 },
})

export function Card({ style, ...rest }: ViewProps) {
  const theme = useTheme()
  return (
    <View
      style={[
        { backgroundColor: theme.backgroundElement, borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
        style,
      ]}
      {...rest}
    />
  )
}

interface ButtonProps {
  title: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  loading?: boolean
  disabled?: boolean
}

export function Button({ title, onPress, variant = 'primary', loading, disabled }: ButtonProps) {
  const theme = useTheme()
  const filled = variant !== 'secondary'
  const fill = variant === 'danger' ? theme.danger : theme.primary
  const inactive = disabled || loading
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: filled ? fill : theme.backgroundElement,
          opacity: inactive ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}>
      {loading ? (
        <ActivityIndicator color={filled ? theme.onPrimary : theme.text} />
      ) : (
        <Text style={[styles.buttonText, { color: filled ? theme.onPrimary : theme.text }]}>{title}</Text>
      )}
    </Pressable>
  )
}

export function TextField({ label, ...rest }: TextInputProps & { label: string }) {
  const theme = useTheme()
  return (
    <View style={{ gap: Spacing.one }}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
        {...rest}
      />
    </View>
  )
}

export function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <AppText variant={bold ? 'heading' : 'muted'} style={styles.rowLabel}>
        {label}
      </AppText>
      <AppText variant={bold ? 'heading' : 'body'} style={styles.amount}>
        {value}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: Spacing.three, minHeight: 48, fontSize: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: Spacing.two },
  rowLabel: { flexShrink: 1 },
  amount: { fontVariant: ['tabular-nums'] },
})
