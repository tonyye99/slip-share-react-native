import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ChevronLeft, Logo } from '@/components/icons'
import { AppText } from '@/components/ui'
import { MaxContentWidth, Spacing } from '@/constants/theme'
import { useT } from '@/i18n'
import { useTheme } from '@/hooks/use-theme'

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'))

export function ScreenHeader({
  title,
  subtitle,
  back = true,
  brand,
  plain,
  right,
  onTitlePress,
  titleHint,
  children,
}: {
  title?: string
  subtitle?: string
  back?: boolean
  brand?: boolean
  plain?: boolean
  right?: ReactNode
  onTitlePress?: () => void
  titleHint?: string
  children?: ReactNode
}) {
  const theme = useTheme()
  const t = useT()
  return (
    <SafeAreaView
      edges={['top']}
      style={[
        styles.bar,
        plain
          ? { backgroundColor: theme.background, borderBottomWidth: 0 }
          : { backgroundColor: theme.surface, borderColor: theme.hairline },
      ]}>
      <View style={styles.inner}>
        <View style={[styles.row, brand && styles.brandRow]}>
          {back && (
            <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" accessibilityLabel={t.common.back} style={styles.back}>
              <ChevronLeft color={theme.text} />
            </Pressable>
          )}
          {brand ? (
            <View style={[styles.titles, styles.brand]}>
              <Logo size={32} />
              <AppText variant="heading" style={styles.brandName}>
                SlipShare
              </AppText>
            </View>
          ) : (
            <Pressable
              onPress={onTitlePress}
              disabled={!onTitlePress}
              accessibilityRole={onTitlePress ? 'button' : undefined}
              accessibilityHint={titleHint}
              style={({ pressed }) => [styles.titles, pressed && { opacity: 0.6 }]}>
              <AppText variant="heading" style={styles.title} numberOfLines={1} accessibilityRole="header">
                {title}
              </AppText>
              {subtitle ? (
                <AppText variant="caption" numberOfLines={1}>
                  {subtitle}
                </AppText>
              ) : null}
            </Pressable>
          )}
          {right}
        </View>
        {children}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: StyleSheet.hairlineWidth },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 56, paddingVertical: Spacing.two },
  back: { width: 24, height: 32, justifyContent: 'center' },
  titles: { flex: 1, gap: 1 },
  title: { fontSize: 20, lineHeight: 25, fontWeight: '700' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  brandRow: { minHeight: 64 },
  brandName: { fontSize: 18, fontWeight: '700' },
})
