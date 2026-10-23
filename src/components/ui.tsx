import { forwardRef, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewProps,
  type ViewStyle,
} from 'react-native'

import { Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'

type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'label'
  | 'muted'
  | 'caption'
  | 'overline'
  | 'error'

export function AppText({ variant = 'body', style, ...rest }: TextProps & { variant?: TextVariant }) {
  const theme = useTheme()
  const color =
    variant === 'muted' || variant === 'caption'
      ? theme.textSecondary
      : variant === 'error'
        ? theme.danger
        : variant === 'overline'
          ? theme.primary
          : theme.text
  return <Text style={[{ color }, textStyles[variant], style]} {...rest} />
}

export const textStyles = StyleSheet.create({
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700', fontVariant: ['tabular-nums'] },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700' },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  muted: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 13, lineHeight: 18 },
  overline: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  error: { fontSize: 14, lineHeight: 20 },
})

/** White rounded panel on the grey page. `dashed` is for a preview of what comes next. */
export function Card({ style, dashed, ...rest }: ViewProps & { dashed?: boolean }) {
  const theme = useTheme()
  return (
    <View
      style={[
        styles.card,
        dashed
          ? { backgroundColor: 'transparent', borderColor: theme.border, borderWidth: 1, borderStyle: 'dashed' }
          : { backgroundColor: theme.surface },
        style,
      ]}
      {...rest}
    />
  )
}

interface ButtonProps {
  title: string
  onPress: () => void
  /** primary: the one main action. strong: near-black, like Sign in. secondary: outlined. danger: outlined, red text. */
  variant?: 'primary' | 'strong' | 'secondary' | 'danger'
  size?: 'default' | 'small' | 'large'
  icon?: ReactNode
  loading?: boolean
  disabled?: boolean
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'default',
  icon,
  loading,
  disabled,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const theme = useTheme()
  const filled = variant === 'primary' || variant === 'strong'
  const fill = variant === 'strong' ? theme.text : theme.primary
  const textColor =
    variant === 'strong' ? theme.surface : filled ? theme.onPrimary : variant === 'danger' ? theme.danger : theme.text
  const inactive = disabled || loading
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        size === 'small' && styles.buttonSmall,
        size === 'large' && styles.buttonLarge,
        filled
          ? { backgroundColor: fill }
          : { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 },
        { opacity: inactive ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.buttonInner}>
          {icon}
          <Text
            style={[
              styles.buttonText,
              size === 'small' && styles.buttonTextSmall,
              size === 'large' && styles.buttonTextLarge,
              { color: textColor },
            ]}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

/** Tappable inline text, for links such as "Privacy policy". */
export function TextLink({ title, onPress, color }: { title: string; onPress: () => void; color?: string }) {
  const theme = useTheme()
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="link" style={styles.textLink}>
      <AppText variant="label" style={{ color: color ?? theme.primary }}>
        {title}
      </AppText>
    </Pressable>
  )
}

/** A text box without a label, for inline rows like "Friend's name  [Add]". */
export const Input = forwardRef<TextInput, TextInputProps>(function Input({ style, ...rest }, ref) {
  const theme = useTheme()
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={theme.textSecondary}
      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }, style]}
      {...rest}
    />
  )
})

export function TextField({ label, ...rest }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: Spacing.one }}>
      <AppText variant="label">{label}</AppText>
      <Input {...rest} />
    </View>
  )
}

export function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <AppText variant={bold ? 'heading' : 'muted'} style={styles.rowLabel}>
        {label}
      </AppText>
      <AppText variant={bold ? 'heading' : 'muted'} style={[styles.amount, !bold && { fontWeight: '500' }]}>
        {value}
      </AppText>
    </View>
  )
}

/** A thin line, with optional words in the middle ("or", "Not on the list?"). */
export function Divider({ label, style }: { label?: string; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme()
  if (!label) return <View style={[styles.line, { backgroundColor: theme.hairline }, style]} />
  return (
    <View style={[styles.divider, style]}>
      <View style={[styles.line, styles.flex, { backgroundColor: theme.hairline }]} />
      <AppText variant="caption">{label}</AppText>
      <View style={[styles.line, styles.flex, { backgroundColor: theme.hairline }]} />
    </View>
  )
}

/** A small grey or coloured label, like "Paid the bill". */
export function Tag({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'primary' | 'success' | 'warning' }) {
  const theme = useTheme()
  const colors = {
    neutral: [theme.backgroundElement, theme.textSecondary],
    primary: [theme.primarySoft, theme.primary],
    success: [theme.successSoft, theme.success],
    warning: [theme.warningSoft, theme.warning],
  }[tone]
  return (
    <View style={[styles.tag, { backgroundColor: colors[0] }]}>
      <AppText variant="caption" style={{ color: colors[1], fontWeight: '600' }}>
        {label}
      </AppText>
    </View>
  )
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const theme = useTheme()
  const percent = Math.max(0, Math.min(1, value)) * 100
  return (
    <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
      <View style={[styles.fill, { width: `${percent}%`, backgroundColor: color ?? theme.primary }]} />
    </View>
  )
}

/** − 1 + for a small count, like how many of a 2 × item someone had. */
export function Stepper({
  value,
  min = 1,
  max,
  onChange,
  label,
}: {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  /** What is being counted, for screen readers ("Egg Kim Bab"). */
  label: string
}) {
  const theme = useTheme()
  const t = useT().common
  const step = (by: number) => {
    const next = Math.min(max, Math.max(min, value + by))
    if (next !== value) onChange(next)
  }
  const button = (by: number, text: string, disabled: boolean) => (
    <Pressable
      onPress={() => step(by)}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={by > 0 ? t.oneMore(label) : t.oneFewer(label)}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.stepButton,
        { borderColor: theme.border, backgroundColor: theme.surface, opacity: disabled ? 0.35 : pressed ? 0.7 : 1 },
      ]}>
      <Text style={[styles.stepSign, { color: theme.primary }]}>{text}</Text>
    </Pressable>
  )
  return (
    <View style={styles.stepper}>
      {button(-1, '−', value <= min)}
      <AppText variant="label" style={[styles.amount, styles.stepValue]} accessibilityLabel={t.countOf(value, label)}>
        {value}
      </AppText>
      {button(1, '+', value >= max)}
    </View>
  )
}

/** Two or three options side by side, like ไทย | EN. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  accessibilityLabel?: string
}) {
  const theme = useTheme()
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.segmented, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            hitSlop={4}
            style={[styles.segment, selected && { backgroundColor: theme.surface }]}>
            <AppText variant="caption" style={{ color: selected ? theme.text : theme.textSecondary, fontWeight: '600' }}>
              {option.label}
            </AppText>
          </Pressable>
        )
      })}
    </View>
  )
}

/** Underlined tabs across the top of a screen, like Items | Payments. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  const theme = useTheme()
  return (
    <View accessibilityRole="tablist" style={[styles.tabs, { borderColor: theme.hairline }]}>
      {tabs.map((tab) => {
        const selected = tab.value === value
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.tab, { borderColor: selected ? theme.primary : 'transparent' }]}>
            <AppText variant="label" style={{ color: selected ? theme.text : theme.textSecondary }}>
              {tab.label}
            </AppText>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.two },
  button: {
    minHeight: 50,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { minHeight: 38, paddingHorizontal: Spacing.three - 2, borderRadius: Radius.medium - 2 },
  buttonLarge: { minHeight: 52, borderRadius: Radius.large },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  buttonText: { fontSize: 16, fontWeight: '600' },
  buttonTextSmall: { fontSize: 14 },
  buttonTextLarge: { fontSize: 17, fontWeight: '700' },
  textLink: { alignSelf: 'flex-start' },
  // minWidth 0 lets a browser shrink the box to make room for a button beside it.
  input: { borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, minHeight: 50, fontSize: 16, minWidth: 0 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: Spacing.two },
  rowLabel: { flexShrink: 1 },
  amount: { fontVariant: ['tabular-nums'] },
  line: { height: StyleSheet.hairlineWidth },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginVertical: Spacing.one },
  tag: { borderRadius: Radius.small - 2, paddingHorizontal: Spacing.two, paddingVertical: 3, alignSelf: 'flex-start' },
  track: { height: 6, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepButton: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepSign: { fontSize: 20, lineHeight: 22, fontWeight: '600' },
  stepValue: { minWidth: 20, textAlign: 'center' },
  segmented: { flexDirection: 'row', borderRadius: Radius.small + 2, borderWidth: 1, padding: 2 },
  segment: { borderRadius: Radius.small, paddingHorizontal: Spacing.two + 2, paddingVertical: Spacing.one + 1 },
  tabs: { flexDirection: 'row', gap: Spacing.four, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { paddingVertical: Spacing.two + 2, borderBottomWidth: 2, marginBottom: -StyleSheet.hairlineWidth },
})
