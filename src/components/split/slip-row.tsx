import { Image } from 'expo-image'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ChevronRight, CloseIcon, ReceiptIcon } from '@/components/icons'
import { AppText } from '@/components/ui'
import { Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { dateLocale, useT } from '@/i18n'
import { slipUrl } from '@/lib/slips'

/** The transfer slip a friend sent through the link. Tap it to see it full size. */
export function SlipRow({ path, sentAt, name }: { path: string; sentAt: string | null; name: string }) {
  const theme = useTheme()
  const { common, split: t } = useT()
  // The link for `path`; a new slip shows the spinner until its own link arrives.
  const [loaded, setLoaded] = useState<{ path: string; url: string | null } | null>(null)
  const [open, setOpen] = useState(false)
  const url = loaded?.path === path ? loaded.url : null
  const failed = loaded?.path === path && !loaded.url

  useEffect(() => {
    let current = true
    slipUrl(path)
      .then((signed) => current && setLoaded({ path, url: signed }))
      .catch((e) => {
        console.error('Slip link failed', e)
        if (current) setLoaded({ path, url: null })
      })
    return () => {
      current = false
    }
  }, [path])

  const sent = sentAt
    ? new Date(sentAt).toLocaleString(dateLocale(), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={!url}
        accessibilityRole="button"
        accessibilityLabel={t.viewSlip(name)}
        style={({ pressed }) => [styles.row, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 }]}>
        <View style={[styles.thumb, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          {url ? (
            <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : failed ? (
            <ReceiptIcon color={theme.textSecondary} size={18} />
          ) : (
            <ActivityIndicator size="small" />
          )}
        </View>
        <View style={styles.flex}>
          <AppText variant="label">{t.transferSlip}</AppText>
          <AppText variant="caption">{failed ? t.slipLoadFailed : sent ? t.slipSentOn(sent) : ''}</AppText>
        </View>
        {url && <ChevronRight color={theme.textSecondary} />}
      </Pressable>

      <Modal visible={open && !!url} animationType="fade" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.viewer}>
          <View style={styles.viewerBar}>
            <AppText variant="label" numberOfLines={1} style={[styles.flex, styles.viewerTitle]}>
              {t.viewSlip(name)}
            </AppText>
            <Pressable
              onPress={() => setOpen(false)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={common.close}
              style={styles.close}>
              <CloseIcon color="#FFFFFF" size={16} />
            </Pressable>
          </View>
          {url && <Image source={{ uri: url }} style={styles.flex} contentFit="contain" />}
        </SafeAreaView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    padding: Spacing.two,
    borderRadius: Radius.medium,
  },
  thumb: {
    width: 40,
    height: 56,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewer: { flex: 1, backgroundColor: '#000000' },
  viewerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  viewerTitle: { color: '#FFFFFF' },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
})
