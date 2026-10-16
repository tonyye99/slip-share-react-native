import { useEffect, useState, type ReactNode } from 'react'
import { Animated, PanResponder, Platform, StyleSheet, View, type ViewStyle } from 'react-native'

import { AppText } from '@/components/ui'
import { Spacing } from '@/constants/theme'

export interface SwipeAction {
  label: string
  color: string
  textColor: string
  icon?: ReactNode
  onAction: () => void
}

// How far a row has to travel before letting go does the action.
const COMMIT_DISTANCE = 96
// Dragging with a mouse would otherwise select the row's text.
const noSelect = Platform.OS === 'web' ? ({ userSelect: 'none' } as unknown as ViewStyle) : null

/**
 * A row you can drag sideways to do something: `start` shows behind it when
 * dragged to the right, `end` when dragged to the left. Letting go far enough
 * does the action and the row springs back. Built on React Native's own
 * PanResponder, like SwipeToDelete, so it runs in Expo Go and drags with a
 * mouse on the website.
 */
export function SwipeActions({
  start,
  end,
  children,
}: {
  start?: SwipeAction
  end?: SwipeAction
  children: ReactNode
}) {
  const [swipe] = useState(() => {
    const x = new Animated.Value(0)
    // The gesture is set up once; it uses the latest actions, passed in after each render.
    let actions: { start?: SwipeAction; end?: SwipeAction } = {}
    const reach = (dx: number) => {
      const { start, end } = actions
      return Math.max(end ? -COMMIT_DISTANCE * 1.6 : 0, Math.min(start ? COMMIT_DISTANCE * 1.6 : 0, dx))
    }
    const settle = () =>
      Animated.spring(x, { toValue: 0, speed: 20, bounciness: 4, useNativeDriver: Platform.OS !== 'web' }).start()
    const responder = PanResponder.create({
      // Only clear sideways drags, so the list still scrolls up and down.
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => x.setValue(reach(g.dx)),
      onPanResponderRelease: (_, g) => {
        const moved = reach(g.dx)
        const { start, end } = actions
        if (start && (moved >= COMMIT_DISTANCE || (moved > 24 && g.vx > 0.8))) start.onAction()
        else if (end && (moved <= -COMMIT_DISTANCE || (moved < -24 && g.vx < -0.8))) end.onAction()
        settle()
      },
      onPanResponderTerminate: settle,
    })
    return {
      x,
      responder,
      use: (next: typeof actions) => {
        actions = next
      },
    }
  })
  useEffect(() => swipe.use({ start, end }))

  const accessibilityActions = [start, end]
    .filter((action): action is SwipeAction => !!action)
    .map((action) => ({ name: action.label, label: action.label }))

  return (
    <View
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={(event) =>
        [start, end].find((action) => action?.label === event.nativeEvent.actionName)?.onAction()
      }>
      {start && <Behind action={start} side="start" x={swipe.x} />}
      {end && <Behind action={end} side="end" x={swipe.x} />}
      <Animated.View style={[{ transform: [{ translateX: swipe.x }] }, noSelect]} {...swipe.responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  )
}

function Behind({ action, side, x }: { action: SwipeAction; side: 'start' | 'end'; x: Animated.Value }) {
  const sign = side === 'start' ? 1 : -1
  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        styles.behind,
        {
          backgroundColor: action.color,
          alignItems: side === 'start' ? 'flex-start' : 'flex-end',
          // Only the side being uncovered shows, and it firms up as you near the point of no return.
          opacity: x.interpolate({
            inputRange: sign > 0 ? [0, 1, COMMIT_DISTANCE] : [-COMMIT_DISTANCE, -1, 0],
            outputRange: sign > 0 ? [0, 0.7, 1] : [1, 0.7, 0],
            extrapolate: 'clamp',
          }),
        },
      ]}>
      <View style={styles.action}>
        {action.icon}
        <AppText variant="label" style={[styles.label, { color: action.textColor }]}>
          {action.label}
        </AppText>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  behind: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'center' },
  // Narrower than COMMIT_DISTANCE, so the label is in full view before letting go does it.
  action: { width: COMMIT_DISTANCE - 8, alignItems: 'center', gap: Spacing.one, paddingHorizontal: Spacing.one },
  label: { fontSize: 13, lineHeight: 18 },
})
