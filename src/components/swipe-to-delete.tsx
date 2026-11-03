import { useState, type ReactNode } from 'react'
import { Animated, PanResponder, Platform, Pressable, StyleSheet, View } from 'react-native'

import { TrashIcon } from '@/components/icons'
import { Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

const ACTION_WIDTH = 84

export function SwipeToDelete({
  onPress,
  onDelete,
  deleteLabel,
  flat,
  children,
}: {
  onPress: () => void
  onDelete: () => void
  deleteLabel: string
  flat?: boolean
  children: (pressed: boolean) => ReactNode
}) {
  const theme = useTheme()
  const [swipe] = useState(() => {
    const x = new Animated.Value(0)
    let open = false
    let dragged = false
    const settle = (toOpen: boolean) => {
      open = toOpen
      Animated.spring(x, {
        toValue: toOpen ? -ACTION_WIDTH : 0,
        speed: 20,
        bounciness: 0,
        useNativeDriver: Platform.OS !== 'web',
      }).start()
    }
    const offset = (dx: number) => (open ? -ACTION_WIDTH : 0) + dx
    const responder = PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragged = true
      },
      onPanResponderMove: (_, g) => x.setValue(Math.min(0, Math.max(-ACTION_WIDTH * 1.4, offset(g.dx)))),
      onPanResponderRelease: (_, g) => settle(g.vx < -0.5 || (g.vx <= 0.5 && offset(g.dx) < -ACTION_WIDTH / 2)),
      onPanResponderTerminate: () => settle(open),
    })
    return {
      x,
      responder,
      close: () => settle(false),
      pressIn: () => {
        dragged = false
      },
      press: (onPress: () => void) => {
        if (dragged) return
        if (open) settle(false)
        else onPress()
      },
    }
  })

  const remove = () => {
    swipe.close()
    onDelete()
  }

  return (
    <View>
      <Animated.View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[
          styles.behind,
          flat && { borderRadius: 0 },
          {
            backgroundColor: theme.destructive,
            opacity: swipe.x.interpolate({ inputRange: [-1, 0], outputRange: [1, 0], extrapolate: 'clamp' }),
          },
        ]}>
        <Pressable onPress={remove} style={styles.action}>
          <TrashIcon color="#FFFFFF" />
        </Pressable>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: swipe.x }] }} {...swipe.responder.panHandlers}>
        <Pressable
          onPressIn={swipe.pressIn}
          onPress={() => swipe.press(onPress)}
          accessibilityRole="button"
          accessibilityActions={[{ name: 'delete', label: deleteLabel }]}
          onAccessibilityAction={(event) => event.nativeEvent.actionName === 'delete' && onDelete()}>
          {({ pressed }) => children(pressed)}
        </Pressable>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  behind: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: Radius.large,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  action: { width: ACTION_WIDTH, height: '100%', alignItems: 'center', justifyContent: 'center' },
})
