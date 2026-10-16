import { StyleSheet, View } from 'react-native'

import { AppText } from '@/components/ui'

/**
 * A ring that fills clockwise from the top, with a label in the middle, like
 * "18% ASSIGNED". Drawn from two clipped half circles, so it needs no SVG.
 */
export function ProgressRing({
  value,
  size = 76,
  stroke = 8,
  color,
  track,
  label,
  caption,
}: {
  /** 0–1. */
  value: number
  size?: number
  stroke?: number
  color: string
  track: string
  label: string
  caption?: string
}) {
  const progress = Math.max(0, Math.min(1, value))
  // A border coloured on its top and right sides covers half the circle; turned
  // 45° that is the right half, from 12 to 6 o'clock.
  const half = (turn: number) => (
    <View
      style={[
        styles.half,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: stroke,
          borderTopColor: color,
          borderRightColor: color,
          transform: [{ rotate: `${45 + turn}deg` }],
        },
      ]}
    />
  )
  return (
    <View style={{ width: size, height: size }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
      <View style={[styles.track, { width: size, height: size, borderRadius: size / 2, borderWidth: stroke, borderColor: track }]} />
      {progress > 0 && (
        <View style={[styles.clip, { left: size / 2, width: size / 2, height: size }]}>
          <View style={{ marginLeft: -size / 2 }}>{half(-180 + Math.min(progress, 0.5) * 360)}</View>
        </View>
      )}
      {progress > 0.5 && (
        <View style={[styles.clip, { left: 0, width: size / 2, height: size }]}>{half((progress - 0.5) * 360)}</View>
      )}
      <View style={styles.center}>
        <AppText variant="heading" style={styles.label}>
          {label}
        </AppText>
        {caption ? (
          <AppText variant="caption" style={styles.caption}>
            {caption}
          </AppText>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  track: { position: 'absolute' },
  clip: { position: 'absolute', top: 0, overflow: 'hidden' },
  half: { borderColor: 'transparent' },
  center: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  label: { fontVariant: ['tabular-nums'] },
  caption: { fontSize: 9, lineHeight: 11, fontWeight: '700', letterSpacing: 0.6 },
})
