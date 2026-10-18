import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { CameraIcon, ImageIcon } from '@/components/icons'
import { Button } from '@/components/ui'
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

// See-through like the split screen's footer; browsers can also blur behind it.
const glassBlur = Platform.OS === 'web' ? ({ backdropFilter: 'blur(16px)' } as unknown as ViewStyle) : null

/** The glass bar at the bottom of home: take a photo of a receipt, or pick one from the library. */
export function ScanFooter({ title, onCamera, onLibrary }: { title: string; onCamera: () => void; onLibrary: () => void }) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, Spacing.three) + Spacing.two }]}>
      <View style={[styles.bar, { backgroundColor: theme.glass, borderColor: theme.hairline }, glassBlur]}>
        <Button title={title} onPress={onCamera} icon={<CameraIcon color={theme.onPrimary} />} style={styles.scan} />
        <Pressable
          onPress={onLibrary}
          accessibilityRole="button"
          accessibilityLabel="Pick a photo from your library"
          style={({ pressed }) => [styles.library, { backgroundColor: theme.primarySoft, opacity: pressed ? 0.8 : 1 }]}>
          <ImageIcon color={theme.primary} size={20} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.three - 4 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: Radius.large + 12,
    padding: Spacing.two,
    boxShadow: '0 8px 28px rgba(16, 24, 27, 0.14)',
  },
  scan: { flex: 1, minHeight: 54, borderRadius: Radius.large + 2 },
  library: { width: 54, height: 54, borderRadius: Radius.large + 2, alignItems: 'center', justifyContent: 'center' },
})
