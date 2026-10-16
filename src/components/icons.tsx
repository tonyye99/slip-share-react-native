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

/** A camera, for taking (or retaking) a photo. */
export function CameraIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'flex-end' }}>
      <View
        style={{
          position: 'absolute',
          top: size * 0.08,
          left: size * 0.32,
          width: size * 0.36,
          height: size * 0.2,
          borderWidth: 2,
          borderBottomWidth: 0,
          borderColor: color,
          borderTopLeftRadius: 2,
          borderTopRightRadius: 2,
        }}
      />
      <View style={[styles.round, { height: size * 0.72, borderWidth: 2, borderRadius: 3, borderColor: color }]}>
        <View style={{ width: size * 0.34, height: size * 0.34, borderRadius: size, borderWidth: 2, borderColor: color }} />
      </View>
    </View>
  )
}

/** A picture with a sun and a hill, for the photo library. */
export function ImageIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderWidth: 2, borderRadius: 3, borderColor: color, overflow: 'hidden' }}>
      <View
        style={{
          position: 'absolute',
          top: size * 0.14,
          right: size * 0.14,
          width: size * 0.2,
          height: size * 0.2,
          borderRadius: size,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: -size * 0.36,
          left: size * 0.02,
          width: size * 0.62,
          height: size * 0.62,
          borderWidth: 2,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  )
}

/** Four corners around a line, for reading a receipt. */
export function ScanIcon({ color, size = 18 }: { color: string; size?: number }) {
  const corner = { position: 'absolute', width: size * 0.32, height: size * 0.32, borderColor: color } as const
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={[corner, { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 3 }]} />
      <View style={[corner, { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 3 }]} />
      <View style={[corner, { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 3 }]} />
      <View style={[corner, { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 3 }]} />
      <View style={{ width: size * 0.56, height: 2, borderRadius: 1, backgroundColor: color }} />
    </View>
  )
}

/** A cog, for settings. `background` fills its middle so the teeth read as an outline. */
export function GearIcon({ color, background, size = 22 }: { color: string; background: string; size?: number }) {
  const tooth = { position: 'absolute', width: size * 0.24, height: size * 0.92, borderRadius: 2, backgroundColor: color } as const
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {[0, 60, 120].map((angle) => (
        <View key={angle} style={[tooth, { transform: [{ rotate: `${angle}deg` }] }]} />
      ))}
      <View
        style={[
          styles.round,
          { width: size * 0.7, height: size * 0.7, borderRadius: size, borderWidth: 2, borderColor: color, backgroundColor: background },
        ]}>
        <View style={{ width: size * 0.28, height: size * 0.28, borderRadius: size, borderWidth: 2, borderColor: color }} />
      </View>
    </View>
  )
}

/** Three dots in a row, for a "more" menu. */
export function DotsIcon({ color, size = 20 }: { color: string; size?: number }) {
  const dot = { width: size * 0.18, height: size * 0.18, borderRadius: size, backgroundColor: color }
  return (
    <View style={{ width: size, height: size, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={dot} />
      <View style={dot} />
      <View style={dot} />
    </View>
  )
}

/** A head and shoulders, for one person. */
export function PersonIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ width: size * 0.42, height: size * 0.42, borderRadius: size, borderWidth: 2, borderColor: color }} />
      <View
        style={{
          width: size * 0.8,
          height: size * 0.42,
          borderWidth: 2,
          borderBottomWidth: 0,
          borderColor: color,
          borderTopLeftRadius: size,
          borderTopRightRadius: size,
        }}
      />
    </View>
  )
}

/** Two people side by side, for "everyone". */
export function PeopleIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <View style={{ width: size * 1.3, height: size, flexDirection: 'row', alignItems: 'flex-end' }}>
      <PersonIcon color={color} size={size * 0.85} />
      <View style={{ marginLeft: -size * 0.3 }}>
        <PersonIcon color={color} size={size} />
      </View>
    </View>
  )
}

/** An X, for closing. */
export function CloseIcon({ color, size = 16 }: { color: string; size?: number }) {
  const bar = { position: 'absolute', width: size * 1.2, height: 2, borderRadius: 1, backgroundColor: color } as const
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[bar, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[bar, { transform: [{ rotate: '-45deg' }] }]} />
    </View>
  )
}

/** A tick mark. */
export function CheckIcon({ color, size = 20, weight = 3 }: { color: string; size?: number; weight?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size * 0.7,
          height: size * 0.38,
          borderLeftWidth: weight,
          borderBottomWidth: weight,
          borderColor: color,
          borderBottomLeftRadius: 1,
          transform: [{ rotate: '-45deg' }],
          marginTop: -size * 0.12,
        }}
      />
    </View>
  )
}

/** A chevron pointing down, or up when `up`. */
export function ChevronDownIcon({ color, size = 10, up }: { color: string; size?: number; up?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRightWidth: 2,
        borderBottomWidth: 2,
        borderColor: color,
        transform: [{ rotate: up ? '-135deg' : '45deg' }],
        marginTop: up ? size * 0.3 : -size * 0.3,
      }}
    />
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
