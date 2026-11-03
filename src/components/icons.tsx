import { Image } from 'expo-image'
import { StyleSheet, View } from 'react-native'

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

export function ChevronRight({ color, size = 8, weight = 2 }: { color: string; size?: number; weight?: number }) {
  return (
    <View style={{ width: size * 0.75 + weight, height: size * 1.42, justifyContent: 'center' }}>
      <View
        style={{
          width: size,
          height: size,
          borderRightWidth: weight,
          borderTopWidth: weight,
          borderColor: color,
          borderRadius: 1,
          transform: [{ rotate: '45deg' }],
          marginLeft: -size * 0.45,
        }}
      />
    </View>
  )
}

export function SendIcon({ color, size = 18, weight = 2 }: { color: string; size?: number; weight?: number }) {
  const tip: Point = [21.5, 2.5]
  const left: Point = [2.5, 9]
  const bottom: Point = [15, 21.5]
  const fold: Point = [10.8, 13.2]
  return (
    <View style={{ width: size, height: size }}>
      {[
        [left, tip],
        [tip, bottom],
        [bottom, fold],
        [fold, left],
        [fold, tip],
      ].map(([from, to], index) => (
        <Line key={index} from={from} to={to} scale={size / 24} color={color} weight={weight} />
      ))}
    </View>
  )
}

export function ReceiptIcon({ color, size = 20, weight = 1.8 }: { color: string; size?: number; weight?: number }) {
  const edges: [Point, Point][] = [
    [[5.5, 2.5], [18.5, 2.5]],
    [[5.5, 2.5], [5.5, 21.5]],
    [[18.5, 2.5], [18.5, 21.5]],
    [[5.5, 21.5], [7.7, 19.8]],
    [[7.7, 19.8], [9.8, 21.5]],
    [[9.8, 21.5], [12, 19.8]],
    [[12, 19.8], [14.2, 21.5]],
    [[14.2, 21.5], [16.3, 19.8]],
    [[16.3, 19.8], [18.5, 21.5]],
    [[9, 7.5], [15, 7.5]],
    [[9, 11.5], [15, 11.5]],
    [[9, 15.5], [12.5, 15.5]],
  ]
  return (
    <View style={{ width: size, height: size }}>
      {edges.map(([from, to], index) => (
        <Line key={index} from={from} to={to} scale={size / 24} color={color} weight={weight} />
      ))}
    </View>
  )
}

type Point = [number, number]

function Line({ from, to, scale, color, weight }: { from: Point; to: Point; scale: number; color: string; weight: number }) {
  const dx = (to[0] - from[0]) * scale
  const dy = (to[1] - from[1]) * scale
  const length = Math.hypot(dx, dy) + weight
  return (
    <View
      style={{
        position: 'absolute',
        left: ((from[0] + to[0]) / 2) * scale - length / 2,
        top: ((from[1] + to[1]) / 2) * scale - weight / 2,
        width: length,
        height: weight,
        borderRadius: weight / 2,
        backgroundColor: color,
        transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
      }}
    />
  )
}

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

export function ScanIcon({ color, size = 18, lines = 1 }: { color: string; size?: number; lines?: 1 | 2 }) {
  const corner = { position: 'absolute', width: size * 0.32, height: size * 0.32, borderColor: color } as const
  const line = { height: 2, borderRadius: 1, backgroundColor: color }
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center', gap: size * 0.14 }}>
      <View style={[corner, { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 3 }]} />
      <View style={[corner, { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 3 }]} />
      <View style={[corner, { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 3 }]} />
      <View style={[corner, { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 3 }]} />
      {lines === 1 ? (
        <View style={[line, { width: size * 0.56 }]} />
      ) : (
        <>
          <View style={[line, { width: size * 0.5 }]} />
          <View style={[line, { width: size * 0.36 }]} />
        </>
      )}
    </View>
  )
}

export function ShieldIcon({ color, size = 20, weight = 1.8 }: { color: string; size?: number; weight?: number }) {
  const edges: [Point, Point][] = [
    [[4.8, 5.6], [12, 3]],
    [[12, 3], [19.2, 5.6]],
    [[19.2, 5.6], [19.2, 12.5]],
    [[19.2, 12.5], [18.2, 16]],
    [[18.2, 16], [15.6, 19]],
    [[15.6, 19], [12, 21]],
    [[12, 21], [8.4, 19]],
    [[8.4, 19], [5.8, 16]],
    [[5.8, 16], [4.8, 12.5]],
    [[4.8, 12.5], [4.8, 5.6]],
  ]
  return (
    <View style={{ width: size, height: size }}>
      {edges.map(([from, to], index) => (
        <Line key={index} from={from} to={to} scale={size / 24} color={color} weight={weight} />
      ))}
    </View>
  )
}

export function ChartIcon({ color, size = 20, weight = 1.8 }: { color: string; size?: number; weight?: number }) {
  const edges: [Point, Point][] = [
    [[4, 20], [20, 20]],
    [[7, 20], [7, 13]],
    [[12, 20], [12, 6]],
    [[17, 20], [17, 10]],
  ]
  return (
    <View style={{ width: size, height: size }}>
      {edges.map(([from, to], index) => (
        <Line key={index} from={from} to={to} scale={size / 24} color={color} weight={weight} />
      ))}
    </View>
  )
}

export function SlidersIcon({
  color,
  background,
  size = 20,
  weight = 1.8,
}: {
  color: string
  background: string
  size?: number
  weight?: number
}) {
  const knob = size * 0.27
  return (
    <View style={{ width: size, height: size, justifyContent: 'space-evenly' }}>
      {[0.68, 0.32, 0.72].map((at, index) => (
        <View key={index} style={{ height: knob, justifyContent: 'center' }}>
          <View style={{ height: weight, borderRadius: weight, backgroundColor: color, marginHorizontal: size * 0.08 }} />
          <View
            style={{
              position: 'absolute',
              left: size * at - knob / 2,
              width: knob,
              height: knob,
              borderRadius: knob,
              borderWidth: weight,
              borderColor: color,
              backgroundColor: background,
            }}
          />
        </View>
      ))}
    </View>
  )
}

export function SignOutIcon({ color, size = 20, weight = 1.8 }: { color: string; size?: number; weight?: number }) {
  const edges: [Point, Point][] = [
    [[4, 12], [15, 12]],
    [[4, 12], [8.5, 7.5]],
    [[4, 12], [8.5, 16.5]],
  ]
  const unit = size / 24
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: 13.5 * unit,
          top: 3.5 * unit - weight / 2,
          width: 6.5 * unit + weight / 2,
          height: 17 * unit + weight,
          borderColor: color,
          borderTopWidth: weight,
          borderRightWidth: weight,
          borderBottomWidth: weight,
          borderTopRightRadius: 3 * unit,
          borderBottomRightRadius: 3 * unit,
        }}
      />
      {edges.map(([from, to], index) => (
        <Line key={index} from={from} to={to} scale={unit} color={color} weight={weight} />
      ))}
    </View>
  )
}

export function GlobeIcon({ color, size = 20, weight = 1.8 }: { color: string; size?: number; weight?: number }) {
  const ball = size * 0.86
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: ball,
          height: ball,
          borderRadius: ball / 2,
          borderWidth: weight,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
        <View
          style={{
            position: 'absolute',
            width: ball * 0.48,
            height: ball + weight,
            borderRadius: ball,
            borderWidth: weight,
            borderColor: color,
          }}
        />
        <View style={{ position: 'absolute', width: ball, height: weight, backgroundColor: color }} />
      </View>
    </View>
  )
}

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

export function PersonIcon({ color, size = 20, weight = 2 }: { color: string; size?: number; weight?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ width: size * 0.42, height: size * 0.42, borderRadius: size, borderWidth: weight, borderColor: color }} />
      <View
        style={{
          width: size * 0.8,
          height: size * 0.42,
          borderWidth: weight,
          borderBottomWidth: 0,
          borderColor: color,
          borderTopLeftRadius: size,
          borderTopRightRadius: size,
        }}
      />
    </View>
  )
}

export function PeopleIcon({ color, size = 22, weight = 2 }: { color: string; size?: number; weight?: number }) {
  return (
    <View style={{ width: size * 1.3, height: size, flexDirection: 'row', alignItems: 'flex-end' }}>
      <PersonIcon color={color} size={size * 0.85} weight={weight} />
      <View style={{ marginLeft: -size * 0.3 }}>
        <PersonIcon color={color} size={size} weight={weight} />
      </View>
    </View>
  )
}

export function CloseIcon({ color, size = 16 }: { color: string; size?: number }) {
  const bar = { position: 'absolute', width: size * 1.2, height: 2, borderRadius: 1, backgroundColor: color } as const
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[bar, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[bar, { transform: [{ rotate: '-45deg' }] }]} />
    </View>
  )
}

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

export function EyeIcon({ color, size = 20, off }: { color: string; size?: number; off?: boolean }) {
  return (
    <Image
      source={off ? require('@/assets/images/eye-off.png') : require('@/assets/images/eye.png')}
      style={{ width: size, height: size }}
      tintColor={color}
    />
  )
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <Image
      source={require('@/assets/images/logo.png')}
      style={{ width: size, height: size, borderRadius: size * 0.225 }}
      accessibilityIgnoresInvertColors
    />
  )
}

const styles = StyleSheet.create({
  round: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
})

export function WalletIcon({ color, size = 20, weight = 1.8 }: { color: string; size?: number; weight?: number }) {
  const s = size / 24
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: 3 * s,
          top: 6 * s,
          width: 18 * s,
          height: 13 * s,
          borderWidth: weight,
          borderColor: color,
          borderRadius: 3 * s,
        }}
      />
      <Line from={[6, 6]} to={[15, 3.5]} scale={s} color={color} weight={weight} />
      <Line from={[15, 3.5]} to={[16.5, 6]} scale={s} color={color} weight={weight} />
      <View
        style={{
          position: 'absolute',
          right: 3 * s,
          top: 10.5 * s,
          width: 6 * s,
          height: 4.5 * s,
          borderWidth: weight,
          borderColor: color,
          borderTopLeftRadius: 2 * s,
          borderBottomLeftRadius: 2 * s,
        }}
      />
    </View>
  )
}

export function QrIcon({ color, size = 20, weight = 1.8 }: { color: string; size?: number; weight?: number }) {
  const s = size / 24
  const corner = (left: number, top: number) => (
    <View
      style={{
        position: 'absolute',
        left: left * s,
        top: top * s,
        width: 8 * s,
        height: 8 * s,
        borderWidth: weight,
        borderColor: color,
        borderRadius: 1.5 * s,
      }}
    />
  )
  const dot = (left: number, top: number) => (
    <View style={{ position: 'absolute', left: left * s, top: top * s, width: 3 * s, height: 3 * s, backgroundColor: color, borderRadius: 0.5 * s }} />
  )
  return (
    <View style={{ width: size, height: size }}>
      {corner(3, 3)}
      {corner(13, 3)}
      {corner(3, 13)}
      {dot(13.5, 13.5)}
      {dot(17.5, 17.5)}
      {dot(17.5, 13.5)}
      {dot(13.5, 17.5)}
    </View>
  )
}

export function BankIcon({ color, size = 20, weight = 1.8 }: { color: string; size?: number; weight?: number }) {
  const lines: [Point, Point][] = [
    [[3, 9], [12, 3.5]],
    [[12, 3.5], [21, 9]],
    [[3, 9], [21, 9]],
    [[6, 11.5], [6, 17]],
    [[12, 11.5], [12, 17]],
    [[18, 11.5], [18, 17]],
    [[3, 20], [21, 20]],
  ]
  return (
    <View style={{ width: size, height: size }}>
      {lines.map(([from, to], index) => (
        <Line key={index} from={from} to={to} scale={size / 24} color={color} weight={weight} />
      ))}
    </View>
  )
}

export function NoteIcon({ color, size = 20, weight = 1.8 }: { color: string; size?: number; weight?: number }) {
  const s = size / 24
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: 5 * s,
          top: 3 * s,
          width: 14 * s,
          height: 18 * s,
          borderWidth: weight,
          borderColor: color,
          borderRadius: 2.5 * s,
        }}
      />
      <Line from={[8.5, 8.5]} to={[15.5, 8.5]} scale={s} color={color} weight={weight} />
      <Line from={[8.5, 12]} to={[15.5, 12]} scale={s} color={color} weight={weight} />
      <Line from={[8.5, 15.5]} to={[12.5, 15.5]} scale={s} color={color} weight={weight} />
    </View>
  )
}

export function CopyIcon({ color, size = 16, weight = 1.8 }: { color: string; size?: number; weight?: number }) {
  const s = size / 24
  const page = { position: 'absolute' as const, width: 13 * s, height: 13 * s, borderWidth: weight, borderColor: color, borderRadius: 2.5 * s }
  return (
    <View style={{ width: size, height: size }}>
      <View style={[page, { left: 3 * s, top: 3 * s, borderRightColor: 'transparent', borderBottomColor: 'transparent' }]} />
      <View style={[page, { left: 8 * s, top: 8 * s }]} />
    </View>
  )
}

export function DownloadIcon({ color, size = 18, weight = 2 }: { color: string; size?: number; weight?: number }) {
  const lines: [Point, Point][] = [
    [[12, 3], [12, 15]],
    [[7, 10.5], [12, 15]],
    [[17, 10.5], [12, 15]],
    [[4, 15], [4, 20]],
    [[4, 20], [20, 20]],
    [[20, 20], [20, 15]],
  ]
  return (
    <View style={{ width: size, height: size }}>
      {lines.map(([from, to], index) => (
        <Line key={index} from={from} to={to} scale={size / 24} color={color} weight={weight} />
      ))}
    </View>
  )
}

export function PencilIcon({ color, size = 18, weight = 1.8 }: { color: string; size?: number; weight?: number }) {
  const lines: [Point, Point][] = [
    [[4, 20], [5, 15]],
    [[5, 15], [15.5, 4.5]],
    [[15.5, 4.5], [19.5, 8.5]],
    [[19.5, 8.5], [9, 19]],
    [[9, 19], [4, 20]],
    [[13, 7], [17, 11]],
  ]
  return (
    <View style={{ width: size, height: size }}>
      {lines.map(([from, to], index) => (
        <Line key={index} from={from} to={to} scale={size / 24} color={color} weight={weight} />
      ))}
    </View>
  )
}
