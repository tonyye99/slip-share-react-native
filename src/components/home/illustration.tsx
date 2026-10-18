import { StyleSheet, View } from 'react-native'

import { usePersonColor } from '@/components/chip'
import { Colors } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

const LIGHT = 'rgba(255, 255, 255, 0.32)'
const DARK = 'rgba(0, 0, 0, 0.22)'

/**
 * A round picture standing in for someone's photo: their colour with a few
 * soft shapes, in one of three styles.
 */
export function PhotoAvatar({ color, size, look = 0, ring = 3 }: { color: string; size: number; look?: number; ring?: number }) {
  const theme = useTheme()
  const shapes = [
    // A dark band across, lighter below it.
    <>
      <View style={[styles.shape, { width: size * 1.6, height: size * 0.62, left: -size * 0.1, top: size * 0.62, backgroundColor: LIGHT, transform: [{ rotate: '-28deg' }] }]} />
      <View style={[styles.shape, { width: size * 1.6, height: size * 0.16, left: -size * 0.3, top: size * 0.46, backgroundColor: DARK, transform: [{ rotate: '-28deg' }] }]} />
    </>,
    // Light in the top left, dark in the bottom right.
    <>
      <View style={[styles.shape, { width: size * 0.75, height: size * 0.75, left: -size * 0.1, top: -size * 0.1, borderRadius: size * 0.2, backgroundColor: LIGHT }]} />
      <View style={[styles.shape, { width: size * 0.7, height: size * 0.7, left: size * 0.45, top: size * 0.5, borderRadius: size * 0.2, backgroundColor: DARK, transform: [{ rotate: '20deg' }] }]} />
    </>,
    // A dark sky over a light hill.
    <>
      <View style={[styles.shape, { width: size * 1.4, height: size * 0.5, left: -size * 0.2, top: -size * 0.12, borderRadius: size * 0.3, backgroundColor: DARK, transform: [{ rotate: '8deg' }] }]} />
      <View style={[styles.shape, { width: size * 0.9, height: size * 0.9, left: size * 0.05, top: size * 0.58, borderRadius: size, backgroundColor: LIGHT }]} />
    </>,
  ]
  return (
    <View
      style={[
        styles.photo,
        {
          width: size + ring * 2,
          height: size + ring * 2,
          borderRadius: size,
          borderWidth: ring,
          borderColor: theme.surface,
          backgroundColor: color,
        },
      ]}>
      {shapes[look % shapes.length]}
    </View>
  )
}

/** The first-time picture: a receipt with three people around it. */
export function SplitIllustration() {
  const theme = useTheme()
  const personColor = usePersonColor()
  const dark = theme === Colors.dark
  const bar = { backgroundColor: dark ? theme.backgroundSelected : '#DCDFE4' }
  return (
    <View style={styles.box} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={[styles.paper, { backgroundColor: dark ? theme.backgroundElement : '#F3F4F6' }]}>
        <View style={[styles.line, bar, { width: 46, marginBottom: 6 }]} />
        {[0, 1, 2].map((row) => (
          <View key={row} style={styles.paperRow}>
            <View style={[styles.line, bar, { flex: 1 }]} />
            <View style={[styles.pill, { backgroundColor: personColor(row) }]} />
          </View>
        ))}
        <View style={[styles.dashes, { borderColor: dark ? theme.border : '#D5D8DD' }]} />
        <View style={[styles.totalBar, { backgroundColor: theme.text }]} />
      </View>
      <View style={[styles.avatar, { left: 0, top: 68 }]}>
        <PhotoAvatar color={personColor(0)} size={44} look={0} />
      </View>
      <View style={[styles.avatar, { left: 128, top: 16 }]}>
        <PhotoAvatar color={personColor(1)} size={44} look={1} />
      </View>
      <View style={[styles.avatar, { left: 113, top: 94 }]}>
        <PhotoAvatar color={personColor(2)} size={44} look={2} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  photo: { overflow: 'hidden' },
  shape: { position: 'absolute' },
  box: { width: 180, height: 148, alignSelf: 'center' },
  paper: {
    position: 'absolute',
    left: 36,
    top: 0,
    width: 106,
    height: 144,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingTop: 16,
    gap: 8,
    transform: [{ rotate: '-4deg' }],
    boxShadow: '0 6px 16px rgba(16, 24, 27, 0.08)',
  },
  paperRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  line: { height: 6, borderRadius: 3 },
  pill: { width: 18, height: 6, borderRadius: 3 },
  dashes: { borderTopWidth: 1.5, borderStyle: 'dashed', marginTop: 10 },
  totalBar: { alignSelf: 'flex-end', width: 38, height: 6, borderRadius: 3, marginTop: 6 },
  avatar: { position: 'absolute', borderRadius: 30, boxShadow: '0 4px 12px rgba(16, 24, 27, 0.18)' },
})
