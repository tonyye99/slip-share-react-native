import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ChevronLeft, Logo } from '@/components/icons'
import { AppText } from '@/components/ui'
import { MaxContentWidth, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

// Screens opened straight from a link have nothing to go back to.
const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'))

/**
 * The white bar at the top of every screen: a back arrow (or the SlipShare
 * mark), the title with a line under it, and room on the right. Anything
 * passed as children, such as tabs, sits at the bottom of the bar.
 */
export function ScreenHeader({
  title,
  subtitle,
  back = true,
  brand,
  plain,
  right,
  children,
}: {
  title?: string
  subtitle?: string
  /** Show the back arrow. */
  back?: boolean
  /** Show the SlipShare mark and name instead of a title. */
  brand?: boolean
  /** Sit on the grey page with no bar or line, like the split screen. */
  plain?: boolean
  right?: ReactNode
  children?: ReactNode
}) {
  const theme = useTheme()
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
        <View style={styles.row}>
          {back && (
            <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
              <ChevronLeft color={theme.text} />
            </Pressable>
          )}
          {brand ? (
            <View style={[styles.titles, styles.brand]}>
              <Logo />
              <AppText variant="heading" style={styles.brandName}>
                SlipShare
              </AppText>
            </View>
          ) : (
            <View style={styles.titles}>
              <AppText variant="heading" style={styles.title} numberOfLines={1} accessibilityRole="header">
                {title}
              </AppText>
              {subtitle ? (
                <AppText variant="caption" numberOfLines={1}>
                  {subtitle}
                </AppText>
              ) : null}
            </View>
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
  brandName: { fontSize: 18, fontWeight: '700' },
})
