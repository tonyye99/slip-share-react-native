import { Image, type ImageSource } from 'expo-image'
import { StyleSheet, View } from 'react-native'

import { CheckIcon, Logo } from '@/components/icons'
import { LanguagePicker } from '@/components/language-picker'
import { AppText } from '@/components/ui'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'

// Laid out on a 366 x 248 canvas as in Ye's "Sign in · v2" design, then scaled to the screen's width.
const CANVAS = { width: 366, height: 248 }
const CHIP_HEIGHT = 43
// The middle of the SlipShare name row, on the canvas.
const BRAND_MIDDLE = 29
const PAID_GREEN = '#34C38F'

/**
 * The panel at the top of sign-in: the SlipShare name and the language
 * dropdown over a little picture of a bill being split.
 */
export function SignInHero({ width }: { width: number }) {
  const theme = useTheme()
  const t = useT()
  const scale = width / CANVAS.width
  const height = CANVAS.height * scale
  return (
    <View style={[styles.hero, { width, height, backgroundColor: theme.panelTint }]}>
      <View
        style={[
          styles.canvas,
          { left: (width - CANVAS.width) / 2, top: (height - CANVAS.height) / 2, transform: [{ scale }] },
        ]}>
        <View style={styles.brand}>
          <Logo size={30} />
          <AppText style={[styles.brandName, { color: theme.text }]} accessibilityRole="header">
            SlipShare
          </AppText>
        </View>

        {/* The picture is decoration, so screen readers skip it. */}
        <View style={StyleSheet.absoluteFill} accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden>
          <Image source={require('@/assets/images/sign-in-slips.png')} style={StyleSheet.absoluteFill} />
          <AmountChip
            name={t.auth.heroYou}
            amount="฿201.66"
            avatar={require('@/assets/images/sign-in-you.png')}
            at={{ left: 20.3, top: 76.2 }}
            tilt="-3deg"
          />
          <AmountChip
            name={t.auth.heroAnna}
            amount="฿254.62"
            avatar={require('@/assets/images/sign-in-anna.png')}
            at={{ right: 16.3, top: 140.5 }}
            tilt="3deg"
          />
          <View style={[styles.paid, { backgroundColor: theme.text }]}>
            <CheckIcon color={PAID_GREEN} size={12} weight={2.2} />
            <AppText style={[styles.paidText, { color: theme.surface }]}>{t.auth.heroBenPaid}</AppText>
          </View>
        </View>
      </View>

      {/* Outside the scaled picture, so it stays full size and easy to tap. */}
      <LanguagePicker style={[styles.language, { top: BRAND_MIDDLE * scale - 16, right: 8.5 * scale }]} />
    </View>
  )
}

function AmountChip({
  name,
  amount,
  avatar,
  at,
  tilt,
}: {
  name: string
  amount: string
  avatar: ImageSource
  /** Where it sits on the canvas. It grows away from that edge to fit the amount. */
  at: { left: number; top: number } | { right: number; top: number }
  tilt: string
}) {
  const theme = useTheme()
  return (
    <View
      style={[
        styles.chip,
        at,
        {
          backgroundColor: theme.surface,
          transform: [{ rotate: tilt }],
        },
      ]}>
      <Image source={avatar} style={styles.avatar} />
      <View>
        <AppText style={[styles.chipName, { color: theme.textSecondary }]}>{name}</AppText>
        <AppText style={[styles.chipAmount, { color: theme.text }]}>{amount}</AppText>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  hero: { borderRadius: 28, overflow: 'hidden', alignSelf: 'center' },
  canvas: { position: 'absolute', width: CANVAS.width, height: CANVAS.height },
  brand: { position: 'absolute', left: 16, top: 14, height: 30, flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandName: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.2 },
  language: { position: 'absolute' },
  chip: {
    position: 'absolute',
    height: CHIP_HEIGHT,
    borderRadius: 15,
    paddingLeft: 8,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    boxShadow: '0 6px 16px rgba(16, 24, 27, 0.12)',
  },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  chipName: { fontSize: 11, lineHeight: 13 },
  chipAmount: { fontSize: 16, lineHeight: 19, fontWeight: '800', letterSpacing: 0.3, fontVariant: ['tabular-nums'] },
  paid: {
    position: 'absolute',
    left: 34.7,
    top: 202.7,
    height: 25,
    borderRadius: 12.5,
    paddingLeft: 9,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  paidText: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
})
