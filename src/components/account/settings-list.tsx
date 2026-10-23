import { Children, type ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { ChevronRight } from '@/components/icons'
import { AppText } from '@/components/ui'
import { Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

/** A small grey heading, like "PRIVACY", over one card of rows split by thin lines. */
export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme()
  const rows = Children.toArray(children)
  return (
    <View style={styles.group}>
      <AppText variant="overline" style={[styles.groupTitle, { color: theme.textSecondary }]} accessibilityRole="header">
        {title}
      </AppText>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        {rows.map((row, index) => (
          <View
            key={index}
            style={index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.hairline }}>
            {row}
          </View>
        ))}
      </View>
    </View>
  )
}

/**
 * One row: an icon on a soft tile, a title with an optional line under it,
 * and a switch or a ">" on the right. With `onPress` the whole row is a button.
 */
export function SettingsRow({
  icon,
  tone = 'neutral',
  title,
  subtitle,
  right,
  chevron,
  onPress,
  disabled,
  accessibilityHint,
}: {
  icon: (color: string, tile: string) => ReactNode
  /** `primary` tints the tile blue. */
  tone?: 'neutral' | 'primary'
  title: string
  subtitle?: string
  right?: ReactNode
  chevron?: boolean
  onPress?: () => void
  disabled?: boolean
  accessibilityHint?: string
}) {
  const theme = useTheme()
  const [tile, ink] = tone === 'primary' ? [theme.primarySoft, theme.primary] : [theme.backgroundElement, theme.textSecondary]
  const body = (pressed: boolean) => (
    <View style={[styles.row, subtitle ? styles.tall : null, { backgroundColor: pressed ? theme.primaryTint : 'transparent' }]}>
      <View style={[styles.tile, { backgroundColor: tile }]}>{icon(ink, tile)}</View>
      <View style={styles.text}>
        <AppText variant="heading">{title}</AppText>
        {subtitle ? (
          <AppText variant="muted" style={[styles.subtitle, { color: theme.textSecondary }]}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
      {chevron && <ChevronRight color={theme.textSecondary} weight={1.8} />}
    </View>
  )
  if (!onPress) return body(false)
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      style={{ opacity: disabled ? 0.5 : 1 }}>
      {({ pressed }) => body(pressed)}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  groupTitle: { fontSize: 13, fontWeight: '600', letterSpacing: 1, marginLeft: Spacing.three },
  card: { borderRadius: Radius.large + 6, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 2,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  tall: { paddingVertical: Spacing.three - 4 },
  tile: { width: 36, height: 36, borderRadius: Radius.medium - 2, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  subtitle: { lineHeight: 18 },
})
