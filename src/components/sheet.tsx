import { useEffect, useState, type ReactNode } from 'react'
import { Animated, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AppText } from '@/components/ui'
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme'
import { useT } from '@/i18n'
import { useTheme } from '@/hooks/use-theme'

/** A panel that slides up from the bottom over a dimmed screen. Tapping outside closes it. */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  right,
  footer,
  children,
}: {
  visible: boolean
  onClose: () => void
  title?: string
  /** A quieter line under the title. */
  subtitle?: string
  /** Shown at the end of the title row, like the bill total. */
  right?: ReactNode
  /** Stays under the scrolling part, like a Send totals button. */
  footer?: ReactNode
  children: ReactNode
}) {
  const theme = useTheme()
  const t = useT()
  const insets = useSafeAreaInsets()
  // The dimmed page fades in or out while the panel slides up or back down.
  const [slide] = useState(() => new Animated.Value(0))
  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: visible ? 280 : 220,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start()
  }, [visible, slide])
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close} />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              paddingBottom: insets.bottom + Spacing.three,
              transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [480, 0] }) }],
            },
          ]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          {title ? (
            <View style={styles.titleRow}>
              <AppText variant="title" style={styles.title} accessibilityRole="header">
                {title}
              </AppText>
              {right}
            </View>
          ) : null}
          {subtitle ? (
            <AppText variant="caption" style={styles.subtitle}>
              {subtitle}
            </AppText>
          ) : null}
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  )
}

/** One row in a sheet of choices. */
export function SheetOption({
  label,
  detail,
  icon,
  selected,
  destructive,
  onPress,
  role = 'button',
}: {
  label: string
  detail?: string
  icon?: ReactNode
  selected?: boolean
  destructive?: boolean
  onPress: () => void
  role?: 'button' | 'radio'
}) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      accessibilityState={role === 'radio' ? { selected: !!selected } : undefined}
      style={({ pressed }) => [styles.option, { backgroundColor: pressed ? theme.backgroundElement : 'transparent' }]}>
      {icon}
      <View style={styles.flex}>
        <AppText variant="label" style={destructive && { color: theme.danger }}>
          {label}
        </AppText>
        {detail ? <AppText variant="caption">{detail}</AppText> : null}
      </View>
      {selected ? <AppText style={[styles.check, { color: theme.primary }]}>✓</AppText> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0, 0, 0, 0.35)' },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    maxHeight: '88%',
    alignSelf: 'center',
    borderTopLeftRadius: Radius.large + 8,
    borderTopRightRadius: Radius.large + 8,
    paddingTop: Spacing.two,
  },
  handle: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: Spacing.two },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three + 4,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  title: { flex: 1, fontSize: 22, lineHeight: 28 },
  subtitle: { paddingHorizontal: Spacing.three + 4, marginTop: -Spacing.one, marginBottom: Spacing.two },
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.two },
  footer: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    minHeight: 52,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.medium,
  },
  check: { fontSize: 18, fontWeight: '700' },
})
