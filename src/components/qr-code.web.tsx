import { useMemo } from 'react'
import { View } from 'react-native'

import { QUIET_ZONE, qrImageUrl, qrModules } from '@/lib/qr'

export function QrCode({ value, size, accessibilityLabel }: { value: string; size: number; accessibilityLabel: string }) {
  const { url, width } = useMemo(() => {
    const modules = qrModules(value)
    const cell = Math.max(1, Math.floor(size / (modules.length + QUIET_ZONE * 2)))
    const width = cell * (modules.length + QUIET_ZONE * 2)
    return { url: typeof document === 'undefined' ? '' : qrImageUrl(modules, cell), width }
  }, [value, size])

  if (!url) return <View style={{ width, height: width, backgroundColor: '#FFFFFF' }} />
  return (
    <img
      src={url}
      alt={accessibilityLabel}
      width={width}
      height={width}
      style={{ display: 'block', width, height: width, imageRendering: 'pixelated', WebkitTouchCallout: 'default' }}
    />
  )
}
