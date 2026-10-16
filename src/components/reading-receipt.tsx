import { Image } from 'expo-image'
import { useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, Animated, Easing, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ScreenHeader } from '@/components/screen-header'
import { AppText, Button, Card } from '@/components/ui'
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { bothNames } from '@/lib/names'
import { billTotal, formatMoney, receiptSubtotal } from '@/lib/split'
import type { ParsedReceipt } from '@/lib/types'

const useNativeDriver = Platform.OS !== 'web'
const THUMB_WIDTH = 112
const THUMB_HEIGHT = 144
const SKELETON_ROWS = 5
// The model sends the whole receipt at once. Its items then appear one after
// another, all within about a second, and the screen moves on soon after.
const REVEAL_MS = 1000
const MAX_ITEM_MS = 120
const HOLD_MS = 700

type StepState = 'pending' | 'active' | 'done' | 'warn'

/**
 * The scan screen while a receipt is being read: the photo with a moving scan
 * line, steps that tick off as each one really finishes, and the items filling
 * in over grey placeholder rows.
 */
export function ReadingReceipt({
  photoUri,
  stage,
  receipt,
  onCancel,
  onDone,
}: {
  photoUri: string
  /** preparing: shrinking the photo on the phone. reading: waiting for the model. */
  stage: 'preparing' | 'reading'
  /** The read receipt, once it arrives. */
  receipt: ParsedReceipt | null
  onCancel: () => void
  /** Called once every item has been shown. */
  onDone: (receipt: ParsedReceipt) => void
}) {
  const theme = useTheme()
  const [shown, setShown] = useState(0)
  const [checked, setChecked] = useState(false)
  const [sweep] = useState(() => new Animated.Value(0))
  const [pulse] = useState(() => new Animated.Value(0.45))

  useEffect(() => {
    if (!receipt) return
    const count = receipt.items.length
    const step = Math.min(MAX_ITEM_MS, REVEAL_MS / Math.max(count, 1))
    const timers = receipt.items.map((_, index) => setTimeout(() => setShown(index + 1), step * (index + 1)))
    timers.push(setTimeout(() => setChecked(true), step * (count + 1)))
    timers.push(setTimeout(() => onDone(receipt), step * (count + 1) + HOLD_MS))
    return () => timers.forEach(clearTimeout)
  }, [receipt, onDone])

  useEffect(() => {
    if (checked) return
    const move = (toValue: number) =>
      Animated.timing(sweep, { toValue, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver })
    const loop = Animated.loop(Animated.sequence([move(1), move(0)]))
    loop.start()
    return () => loop.stop()
  }, [sweep, checked])

  useEffect(() => {
    const fade = (toValue: number) => Animated.timing(pulse, { toValue, duration: 700, useNativeDriver })
    const loop = Animated.loop(Animated.sequence([fade(1), fade(0.45)]))
    loop.start()
    return () => loop.stop()
  }, [pulse])

  const money = (amount: number) => formatMoney(amount, receipt?.currency || 'THB')
  const count = receipt?.items.length ?? 0

  const totalStep = (): { state: StepState; text: string } => {
    if (!receipt) return { state: 'pending', text: 'Check the total' }
    if (!checked) return { state: 'active', text: 'Checking the total' }
    if (receipt.total <= 0) return { state: 'done', text: 'Total added up' }
    const addsUp = Math.abs(billTotal(receipt, receiptSubtotal(receipt.items)) - receipt.total) < 0.5
    return addsUp
      ? { state: 'done', text: `Total matches ${money(receipt.total)}` }
      : { state: 'warn', text: "Total doesn't match. Check it next." }
  }

  const steps: { id: string; state: StepState; text: string }[] = [
    {
      id: 'photo',
      ...(stage === 'preparing'
        ? { state: 'active', text: 'Getting the photo ready' }
        : { state: 'done', text: 'Photo ready' }),
    },
    {
      id: 'items',
      ...(receipt
      ? count > 0
        ? { state: 'done', text: `Found ${count} item${count === 1 ? '' : 's'}` }
        : { state: 'warn', text: 'No items found' }
      : stage === 'reading'
        ? { state: 'active', text: 'Reading the items' }
        : { state: 'pending', text: 'Find the items' }),
    },
    { id: 'total', ...totalStep() },
  ]

  const skeletons = receipt ? count - shown : SKELETON_ROWS
  const rowBorder = (index: number) =>
    index > 0 && { borderTopColor: theme.hairline, borderTopWidth: StyleSheet.hairlineWidth }

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Reading receipt" />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <View style={styles.top}>
          <View style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}>
            <Image source={{ uri: photoUri }} style={styles.thumbImage} contentFit="cover" />
            {!checked && (
              <Animated.View
                style={[
                  styles.scanLine,
                  {
                    backgroundColor: theme.primary,
                    boxShadow: `0 0 10px 3px ${theme.primary}`,
                    transform: [{ translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [6, THUMB_HEIGHT - 8] }) }],
                  },
                ]}
              />
            )}
          </View>
          <View style={styles.steps} accessibilityLiveRegion="polite">
            {steps.map((step) => (
              <View key={step.id} style={styles.step}>
                <StepMark state={step.state} />
                <AppText
                  variant={step.state === 'active' ? 'label' : 'body'}
                  style={[styles.flex, step.state === 'pending' && { color: theme.textSecondary }]}>
                  {step.text}
                </AppText>
              </View>
            ))}
          </View>
        </View>

        <Card style={styles.list}>
          {receipt?.items.slice(0, shown).map((item, index) => {
            const name = bothNames(item.name, item.name_en ?? null, true).main
            return (
              <FadeIn key={`${item.id}-${index}`}>
                <View style={[styles.row, rowBorder(index)]}>
                  <View style={styles.flex}>
                    <AppText variant="heading">{name}</AppText>
                    <AppText variant="caption">
                      {item.qty} × {money(item.unit_price)}
                    </AppText>
                  </View>
                  <AppText variant="heading" style={styles.amount}>
                    {money(item.qty * item.unit_price)}
                  </AppText>
                </View>
              </FadeIn>
            )
          })}
          {Array.from({ length: skeletons }, (_, index) => (
            <Animated.View key={`skeleton-${index}`} style={[styles.row, rowBorder(shown + index), { opacity: pulse }]}>
              <View style={[styles.flex, styles.skeletonText]}>
                <View style={[styles.bar, { width: `${[62, 48, 70, 52, 58][index % 5]}%`, backgroundColor: theme.backgroundSelected }]} />
                <View style={[styles.bar, styles.barSmall, { backgroundColor: theme.backgroundElement }]} />
              </View>
              <View style={[styles.bar, styles.barPrice, { backgroundColor: theme.backgroundSelected }]} />
            </Animated.View>
          ))}
          <AppText variant="caption" style={[styles.note, { borderTopColor: theme.hairline }]}>
            You&apos;ll be able to fix anything we misread.
          </AppText>
        </Card>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={[styles.footerBar, { backgroundColor: theme.surface, borderColor: theme.hairline }]}>
        <View style={styles.footer}>
          <Button title="Cancel" variant="secondary" onPress={onCancel} />
        </View>
      </SafeAreaView>
    </View>
  )
}

function StepMark({ state }: { state: StepState }) {
  const theme = useTheme()
  if (state === 'active') return <ActivityIndicator color={theme.primary} style={styles.mark} />
  if (state === 'pending') return <View style={[styles.mark, styles.markEmpty, { borderColor: theme.border }]} />
  const done = state === 'done'
  return (
    <View style={[styles.mark, { backgroundColor: done ? theme.success : theme.warning }]}>
      <AppText style={[styles.markText, { color: theme.onPrimary }]}>{done ? '✓' : '!'}</AppText>
    </View>
  )
}

/** Fades a row in and lifts it into place as it appears. */
function FadeIn({ children }: { children: ReactNode }) {
  const [progress] = useState(() => new Animated.Value(0))
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver }).start()
  }, [progress])
  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
      }}>
      {children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  thumb: { width: THUMB_WIDTH, height: THUMB_HEIGHT, borderRadius: Radius.medium, overflow: 'hidden' },
  thumbImage: { width: THUMB_WIDTH, height: THUMB_HEIGHT },
  scanLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  steps: { flex: 1, gap: Spacing.three - 4 },
  step: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2 },
  mark: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  markEmpty: { borderWidth: 2 },
  markText: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  list: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, gap: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two + 1, minHeight: 58 },
  amount: { fontVariant: ['tabular-nums'] },
  skeletonText: { gap: Spacing.two },
  bar: { height: 12, borderRadius: Radius.pill },
  barSmall: { width: '30%', height: 10 },
  barPrice: { width: 56 },
  note: { paddingVertical: Spacing.three - 4, borderTopWidth: StyleSheet.hairlineWidth },
  footerBar: { borderTopWidth: StyleSheet.hairlineWidth },
  footer: { padding: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
})
