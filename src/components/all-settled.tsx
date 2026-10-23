import { useEffect, useState } from 'react'
import { Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Avatar } from '@/components/chip'
import { CheckIcon, CloseIcon, ShareIcon } from '@/components/icons'
import { AppText, TextLink } from '@/components/ui'
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

export interface SettledPerson {
  id: string
  name: string
  color: string
  amount: number
  paidTheBill: boolean
}

const useNativeDriver = Platform.OS !== 'web'
// Little teeth along the bottom of the receipt card.
const TOOTH = 7
const TEETH = 60

/** Shown once the last person pays the payer back: a tick, the receipt and a way to tell the group. */
export function AllSettled({
  visible,
  onClose,
  title,
  date,
  payerName,
  paidBack,
  people,
  total,
  money,
  onShare,
}: {
  visible: boolean
  onClose: () => void
  title: string
  date: string
  /** "you", or the payer's name. */
  payerName: string
  paidBack: number
  people: SettledPerson[]
  total: number
  money: (amount: number) => string
  onShare: () => void
}) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [pop] = useState(() => new Animated.Value(0))

  useEffect(() => {
    if (!visible) return
    pop.setValue(0)
    Animated.spring(pop, { toValue: 1, speed: 10, bounciness: 12, useNativeDriver }).start()
  }, [visible, pop])

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={[styles.page, { backgroundColor: theme.successSoft, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.inner}>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={[styles.close, { backgroundColor: theme.surface }]}>
            <CloseIcon color={theme.text} />
          </Pressable>
          <ScrollView contentContainerStyle={styles.content}>
            <Animated.View style={[styles.rings, { transform: [{ scale: pop }] }]}>
              <View style={[styles.ring, styles.ringOuter, { backgroundColor: `${theme.success}14` }]} />
              <View style={[styles.ring, styles.ringMiddle, { backgroundColor: `${theme.success}26` }]} />
              <View style={[styles.ring, styles.ringInner, { backgroundColor: theme.success }]}>
                <CheckIcon color={theme.successSoft} size={40} weight={5} />
              </View>
            </Animated.View>
            <AppText variant="title" style={styles.heading} accessibilityRole="header">
              All settled
            </AppText>
            <AppText variant="muted" style={styles.center}>
              Everyone paid {payerName} back{' '}
              <AppText variant="muted" style={{ color: theme.success, fontWeight: '700' }}>
                {money(paidBack)}
              </AppText>
            </AppText>

            <View>
              <View style={[styles.slip, { backgroundColor: theme.surface }]}>
                <View style={styles.slipHeader}>
                  <AppText variant="heading" style={styles.flex} numberOfLines={1}>
                    {title}
                  </AppText>
                  <AppText variant="caption">{date}</AppText>
                </View>
                {people.map((person) => (
                  <View key={person.id} style={styles.person}>
                    <Avatar name={person.name} color={person.color} size={30} />
                    <View style={styles.flex}>
                      <AppText variant="label">{person.name}</AppText>
                      <AppText
                        variant="caption"
                        style={!person.paidTheBill && { color: theme.success, fontWeight: '600' }}>
                        {person.paidTheBill ? 'Paid the bill' : 'Paid back'}
                      </AppText>
                    </View>
                    <AppText variant="label" style={styles.amount}>
                      {money(person.amount)}
                    </AppText>
                  </View>
                ))}
                <View style={[styles.dashed, { borderColor: theme.border }]} />
                <View style={styles.totalRow}>
                  <AppText variant="muted" style={styles.flex}>
                    Total
                  </AppText>
                  <AppText variant="title" style={styles.amount}>
                    {money(total)}
                  </AppText>
                </View>
              </View>
              <View style={styles.teeth}>
                {Array.from({ length: TEETH }, (_, index) => (
                  <View key={index} style={[styles.tooth, { borderTopColor: theme.surface }]} />
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.buttons}>
            <Pressable
              onPress={onShare}
              accessibilityRole="button"
              style={({ pressed }) => [styles.share, { backgroundColor: theme.text, opacity: pressed ? 0.85 : 1 }]}>
              <ShareIcon color={theme.background} />
              <AppText variant="label" style={[styles.shareText, { color: theme.background }]}>
                Share to the group
              </AppText>
            </Pressable>
            <View style={styles.done}>
              <TextLink title="Done" color={theme.success} onPress={onClose} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  page: { flex: 1 },
  inner: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  close: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    zIndex: 1,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: Spacing.three + 8, paddingTop: Spacing.five, gap: Spacing.three, alignItems: 'stretch' },
  rings: { width: 132, height: 132, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  ringOuter: { width: 132, height: 132 },
  ringMiddle: { width: 108, height: 108 },
  ringInner: { width: 88, height: 88 },
  heading: { textAlign: 'center', fontSize: 30, lineHeight: 36, fontWeight: '800', marginTop: -Spacing.one },
  slip: {
    marginTop: Spacing.three,
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    padding: Spacing.three + 4,
    paddingBottom: Spacing.three,
    gap: Spacing.three - 4,
    boxShadow: '0 8px 24px rgba(16, 24, 27, 0.08)',
  },
  slipHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.one },
  person: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4 },
  amount: { fontVariant: ['tabular-nums'] },
  dashed: { borderTopWidth: 1.5, borderStyle: 'dashed', marginTop: Spacing.one },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  teeth: { flexDirection: 'row', overflow: 'hidden', height: TOOTH },
  tooth: {
    width: 0,
    height: 0,
    borderLeftWidth: TOOTH,
    borderRightWidth: TOOTH,
    borderTopWidth: TOOTH,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  buttons: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three, gap: Spacing.two, maxWidth: MaxContentWidth },
  share: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 54,
    borderRadius: Radius.medium,
  },
  shareText: { fontSize: 17 },
  done: { alignSelf: 'center', paddingVertical: Spacing.two },
})
