import { useMemo } from 'react'
import { View } from 'react-native'

import { QUIET_ZONE, qrImageUrl, qrModules } from '@/lib/qr'

/**
 * The website's QR code: a real picture, so friends can press and hold it to
 * save it (Save to Photos on iPhone, Download image on Android). Black on
 * white whatever the theme: banking apps read that best.
 */
export function QrCode({ value, size, accessibilityLabel }: { value: string; size: number; accessibilityLabel: string }) {
  const { url, width } = useMemo(() => {
    const modules = qrModules(value)
    // Whole points per square keep the edges sharp.
    const cell = Math.max(1, Math.floor(size / (modules.length + QUIET_ZONE * 2)))
    const width = cell * (modules.length + QUIET_ZONE * 2)
    // Pages are first drawn on the server, where there is no canvas.
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
