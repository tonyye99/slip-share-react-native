import { useState } from 'react'
import { PanResponder, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { SendIcon } from '@/components/icons'
import { AppText, Button } from '@/components/ui'
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'
import { eachOf } from '@/lib/split'
import type { Money } from '@/lib/split-view'

const glassBlur = Platform.OS === 'web' ? ({ backdropFilter: 'blur(16px)' } as unknown as ViewStyle) : null
const glassy = Platform.OS === 'web'

export function SplitFooter({
  alone,
  myTotal,
  mineCount,
  itemCount,
  left,
  leftItems,
  money,
  owe,
  mine,
  onOpenBreakdown,
  onSend,
}: {
  alone: boolean
  myTotal: number
  mineCount: number
  itemCount: number
  left: number
  leftItems: number
  money: Money
  owe: { payer: string; amount: number; paid: boolean } | null
  mine: { payers: string[]; paid: boolean; count: number } | null
  onOpenBreakdown: () => void
  onSend: () => void
}) {
  const theme = useTheme()
  const all = useT()
  const t = all.split
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
  if (mine) {
    const counted = all.common.items(mine.count)
    const owing =
      mine.payers.length > 1
        ? all.common.each(money(eachOf(myTotal, mine.payers.length)))
        : `${mine.payers.length === 1 ? t.youOwe(mine.payers[0]) : all.mine.yourShare} · ${counted}`
    summary = (
      <>
        <AppText
          variant="heading"
          style={[styles.amount, mine.paid && { color: theme.success }]}
          numberOfLines={1}
          adjustsFontSizeToFit>
          {money(myTotal)}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {mine.paid
            ? all.mine.paidBack
            : owing}
        </AppText>
      </>
    )
  } else if (alone) {
    summary = (
      <>
        <AppText variant="heading" style={styles.amount} numberOfLines={1}>
          {mineCount > 0 ? money(myTotal) : t.youTotal(money(myTotal))}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {owe ? (owe.paid ? t.youPaidBack(owe.payer) : t.youOwe(owe.payer)) : mineCount > 0 ? t.mineOf(mineCount, itemCount) : t.tickForShare}
        </AppText>
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
          {money(owe.amount)}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {owe.paid ? t.youPaidBack(owe.payer) : t.youOwe(owe.payer)}
        </AppText>
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
      <View style={[styles.footer, { backgroundColor: glassy ? theme.glass : theme.surface, borderColor: theme.hairline }, glassBlur]} {...pullUp.panHandlers}>
        <Pressable onPress={onOpenBreakdown} accessibilityRole="button" accessibilityLabel={t.seeBreakdown} style={styles.summary}>
          {summary}
        </Pressable>
        {mine ? (
          <Button
            title={
              mine.paid
                ? all.mine.sendAgain
                : mine.payers.length > 0
                  ? all.mine.sendTo(all.mine.payers(mine.payers))
                  : all.mine.pickPayerFirst
            }
            variant={mine.paid || mine.payers.length === 0 ? 'secondary' : 'primary'}
            onPress={onSend}
            disabled={mine.payers.length > 0 && !mine.paid && myTotal < 0.005}
            style={styles.send}
          />
        ) : (
          <Button
            title={owe ? t.sendMyShare : t.sendTotals}
            onPress={onSend}
            icon={<SendIcon color={theme.onPrimary} />}
            style={styles.send}
          />
        )}
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
  send: { flexShrink: 1, maxWidth: '62%', paddingHorizontal: Spacing.four + 2, borderRadius: Radius.pill },
})
