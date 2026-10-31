import { useState } from 'react'
import { PanResponder, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { SendIcon } from '@/components/icons'
import { AppText, Button } from '@/components/ui'
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'
import type { Money } from '@/lib/split-view'

// The footer is see-through; browsers can also blur the list behind it.
const glassBlur = Platform.OS === 'web' ? ({ backdropFilter: 'blur(16px)' } as unknown as ViewStyle) : null

/**
 * The glass footer over the split screen: how much is left to assign and
 * "Send totals". On a bill a friend paid it shows what you owe them, and the
 * button sends your share. Tapping it, or pulling it up, opens the breakdown.
 */
export function SplitFooter({
  alone,
  myTotal,
  left,
  leftItems,
  money,
  owe,
  onOpenBreakdown,
  onSend,
}: {
  alone: boolean
  myTotal: number
  /** Amount nobody has been given yet. */
  left: number
  leftItems: number
  money: Money
  /** On a bill a friend paid: who paid, what you owe them and if you've paid them back. */
  owe: { payer: string; amount: number; paid: boolean } | null
  onOpenBreakdown: () => void
  onSend: () => void
}) {
  const theme = useTheme()
  const t = useT().split
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
          {t.youTotal(money(myTotal))}
        </AppText>
        <AppText variant="caption">{t.justYou}</AppText>
      </>
    )
  } else if (Math.abs(left) >= 0.005) {
    summary = (
      <>
        <AppText variant="heading" style={[styles.amount, { color: theme.warning }]} numberOfLines={1}>
          {t.left(money(left))}
        </AppText>
        <AppText variant="caption">{t.toGo(leftItems)}</AppText>
      </>
    )
  } else if (owe) {
    summary = (
      <>
        <AppText
          variant="heading"
          style={[styles.amount, owe.paid && { color: theme.success }]}
          numberOfLines={1}
          adjustsFontSizeToFit>
          {owe.paid ? t.youPaidBack(owe.payer) : t.youOweAmount(money(owe.amount))}
        </AppText>
        <AppText variant="caption">{t.seeBreakdown}</AppText>
      </>
    )
  } else {
    summary = (
      <>
        <AppText variant="heading" style={{ color: theme.success }}>
          {t.allAssigned}
        </AppText>
        <AppText variant="caption">{t.seeBreakdown}</AppText>
      </>
    )
  }

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: insets.bottom + Spacing.three - 4 }]}>
      <View style={[styles.footer, { backgroundColor: theme.glass, borderColor: theme.hairline }, glassBlur]} {...pullUp.panHandlers}>
        <Pressable onPress={onOpenBreakdown} accessibilityRole="button" accessibilityLabel={t.seeBreakdown} style={styles.summary}>
          {summary}
        </Pressable>
        <Button title={owe ? t.sendMyShare : t.sendTotals} onPress={onSend} icon={<SendIcon color={theme.onPrimary} />} style={styles.send} />
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
    padding: Spacing.two,
    paddingLeft: Spacing.three,
    boxShadow: '0 8px 28px rgba(16, 24, 27, 0.14)',
  },
  summary: { flex: 1, minHeight: 44, justifyContent: 'center' },
  send: { paddingHorizontal: Spacing.four + 2, borderRadius: Radius.pill },
})
