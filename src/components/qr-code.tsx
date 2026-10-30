import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { QUIET_ZONE, qrModules } from '@/lib/qr'

/**
 * A QR code up to `size` points wide, drawn as one box per run of dark
 * squares in a row. Black on white whatever the theme: banking apps read that best.
 */
export function QrCode({ value, size, accessibilityLabel }: { value: string; size: number; accessibilityLabel: string }) {
  const { cell, width, runs } = useMemo(() => {
    const modules = qrModules(value)
    const count = modules.length
    // Whole points per square keep the edges sharp, with no gaps between rows.
    const cell = Math.max(1, Math.floor(size / (count + QUIET_ZONE * 2)))
    const runs: { row: number; col: number; length: number }[] = []
    modules.forEach((dark, row) => {
      for (let col = 0; col < count; col++) {
        if (!dark[col]) continue
        let length = 1
        while (col + length < count && dark[col + length]) length++
        runs.push({ row, col, length })
        col += length - 1
      }
    })
    return { cell, width: cell * (count + QUIET_ZONE * 2), runs }
  }, [value, size])

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[styles.box, { width, height: width }]}>
      {runs.map(({ row, col, length }) => (
        <View
          key={`${row}-${col}`}
          style={[
            styles.dark,
            {
              top: (row + QUIET_ZONE) * cell,
              left: (col + QUIET_ZONE) * cell,
              width: length * cell,
              height: cell,
            },
          ]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#FFFFFF' },
  dark: { position: 'absolute', backgroundColor: '#000000' },
})
