import { StyleSheet, View } from 'react-native'

import { Radius } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

// Small line icons drawn with Views, so they need no icon font or extra package.

export function ChevronLeft({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderLeftWidth: 2.5,
        borderBottomWidth: 2.5,
        borderColor: color,
        borderRadius: 1,
        transform: [{ rotate: '45deg' }],
        marginLeft: size / 3,
      }}
    />
  )
}

/** Arrow up out of a tray, for sharing. */
export function ShareIcon({ color, size = 18 }: { color: string; size?: number }) {
  const arrow = size * 0.4
  return (
    <View style={{ width: size, height: size, alignItems: 'center' }}>
      <View
        style={{
          position: 'absolute',
          top: 1,
          width: arrow,
          height: arrow,
          borderLeftWidth: 2,
          borderTopWidth: 2,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View style={{ position: 'absolute', top: 1, width: 2, height: size * 0.62, backgroundColor: color, borderRadius: 1 }} />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          width: size * 0.8,
          height: size * 0.45,
          borderLeftWidth: 2,
          borderRightWidth: 2,
          borderBottomWidth: 2,
          borderColor: color,
          borderBottomLeftRadius: 3,
          borderBottomRightRadius: 3,
        }}
      />
    </View>
  )
}

/** Two chain links, for the friend link. */
export function LinkIcon({ color, size = 20 }: { color: string; size?: number }) {
  const link = { width: size * 0.62, height: size * 0.36, borderWidth: 2, borderColor: color, borderRadius: size }
  return (
    <View style={{ width: size, height: size, transform: [{ rotate: '-45deg' }], justifyContent: 'center' }}>
      <View style={[link, { position: 'absolute', left: 0 }]} />
      <View style={[link, { position: 'absolute', right: 0 }]} />
    </View>
  )
}

export function ClockIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <View style={[styles.round, { width: size, height: size, borderRadius: size / 2, borderColor: color }]}>
      <View style={{ position: 'absolute', top: size * 0.18, left: size / 2 - 1.5, width: 1.5, height: size * 0.34, backgroundColor: color }} />
      <View style={{ position: 'absolute', top: size / 2 - 1.5, left: size / 2 - 1.5, width: size * 0.28, height: 1.5, backgroundColor: color }} />
    </View>
  )
}

/** A ticked box, for "tick what you had". */
export function CheckBoxIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <View style={[styles.round, { width: size, height: size, borderRadius: 4, borderColor: color }]}>
      <View
        style={{
          width: size * 0.45,
          height: size * 0.25,
          borderLeftWidth: 1.5,
          borderBottomWidth: 1.5,
          borderColor: color,
          transform: [{ rotate: '-45deg' }],
          marginTop: -size * 0.1,
        }}
      />
    </View>
  )
}

/** A bin with its lid, for deleting. */
export function TrashIcon({ color, size = 22 }: { color: string; size?: number }) {
  const stroke = 2
  return (
    <View style={{ width: size, height: size, alignItems: 'center' }}>
      <View
        style={{
          width: size * 0.32,
          height: size * 0.14,
          borderWidth: stroke,
          borderBottomWidth: 0,
          borderColor: color,
          borderTopLeftRadius: 2,
          borderTopRightRadius: 2,
        }}
      />
      <View style={{ width: size * 0.9, height: stroke, borderRadius: 1, backgroundColor: color }} />
      <View
        style={{
          flex: 1,
          width: size * 0.66,
          marginTop: size * 0.06,
          paddingVertical: size * 0.12,
          borderWidth: stroke,
          borderTopWidth: 0,
          borderColor: color,
          borderBottomLeftRadius: 3,
          borderBottomRightRadius: 3,
          flexDirection: 'row',
          justifyContent: 'space-evenly',
        }}>
        <View style={{ width: 1.5, backgroundColor: color }} />
        <View style={{ width: 1.5, backgroundColor: color }} />
      </View>
    </View>
  )
}

/** The SlipShare mark: a receipt on a blue tile. */
export function Logo({ size = 28 }: { size?: number }) {
  const theme = useTheme()
  const line = { height: 2, borderRadius: 1, backgroundColor: theme.primary }
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: theme.primary }]}>
      <View style={[styles.slip, { width: size * 0.46, height: size * 0.6, padding: size * 0.08 }]}>
        <View style={[line, { width: '100%' }]} />
        <View style={[line, { width: '100%' }]} />
        <View style={[line, { width: '60%' }]} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  round: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tile: { alignItems: 'center', justifyContent: 'center' },
  slip: { backgroundColor: '#FFFFFF', borderRadius: Radius.small / 4, justifyContent: 'space-evenly' },
})
