import { useState } from 'react'
import { PanResponder, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ShareIcon } from '@/components/icons'
import { AppText, Button } from '@/components/ui'
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { countLabel, type Money } from '@/lib/split-view'

// The footer is see-through; browsers can also blur the list behind it.
const glassBlur = Platform.OS === 'web' ? ({ backdropFilter: 'blur(16px)' } as unknown as ViewStyle) : null

/**
 * The glass footer over the split screen: how much is left to assign and
 * "Send totals". Tapping it, or pulling it up, opens the breakdown.
 */
export function SplitFooter({
  alone,
  myTotal,
  left,
  leftItems,
  money,
  onOpenBreakdown,
  onSend,
}: {
  alone: boolean
  myTotal: number
  /** Amount nobody has been given yet. */
  left: number
  leftItems: number
  money: Money
  onOpenBreakdown: () => void
  onSend: () => void
}) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [pullUp] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy < -8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dy < -24) onOpenBreakdown()
      },
    }),
  )

  let summary
  if (alone) {
    summary = (
      <>
        <AppText variant="heading" style={styles.amount}>
          You {money(myTotal)}
        </AppText>
        <AppText variant="caption">Just you so far</AppText>
      </>
    )
  } else if (Math.abs(left) >= 0.005) {
    summary = (
      <>
        <AppText variant="heading" style={[styles.amount, { color: theme.warning }]} numberOfLines={1}>
          {money(left)} left
        </AppText>
        <AppText variant="caption">{countLabel(leftItems, 'item')} to go</AppText>
      </>
    )
  } else {
    summary = (
      <>
        <AppText variant="heading" style={{ color: theme.success }}>
          ✓ All assigned
        </AppText>
        <AppText variant="caption">See the breakdown</AppText>
      </>
    )
  }

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: insets.bottom + Spacing.three - 4 }]}>
      <View style={[styles.footer, { backgroundColor: theme.glass, borderColor: theme.hairline }, glassBlur]} {...pullUp.panHandlers}>
        <Pressable onPress={onOpenBreakdown} accessibilityRole="button" accessibilityLabel="See the breakdown" style={styles.summary}>
          {summary}
        </Pressable>
        <Button title="Send totals" onPress={onSend} icon={<ShareIcon color={theme.onPrimary} />} style={styles.send} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  amount: { fontVariant: ['tabular-nums'] },
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.three - 4 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: Radius.large + 6,
    padding: Spacing.two + 2,
    paddingLeft: Spacing.three,
    boxShadow: '0 8px 28px rgba(16, 24, 27, 0.14)',
  },
  summary: { flex: 1, minHeight: 44, justifyContent: 'center' },
  send: { paddingHorizontal: Spacing.four, borderRadius: Radius.medium + 2 },
})
