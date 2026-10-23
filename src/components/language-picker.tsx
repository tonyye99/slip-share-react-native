import { useRef, useState } from 'react'
import { Modal, Pressable, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native'

import { CheckIcon, ChevronDownIcon, GlobeIcon } from '@/components/icons'
import { AppText } from '@/components/ui'
import { useTheme } from '@/hooks/use-theme'
import { useLanguage, useT, type Language } from '@/i18n'

// Each language is shown in its own words, so it can be found without reading the other.
const LANGUAGES: { value: Language; name: string }[] = [
  { value: 'en', name: 'English' },
  { value: 'th', name: 'ไทย' },
]

interface Anchor {
  x: number
  y: number
  width: number
  height: number
}

/**
 * A small "English ⌄" button. Tapping it drops down the languages under it;
 * picking one changes the app's words right away and is remembered.
 */
export function LanguagePicker({ background, style }: { background?: string; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme()
  const t = useT()
  const { language, setLanguage } = useLanguage()
  const { width: windowWidth } = useWindowDimensions()
  const button = useRef<View>(null)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const current = LANGUAGES.find((option) => option.value === language) ?? LANGUAGES[0]

  const open = () => button.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }))
  const close = () => setAnchor(null)
  const pick = (next: Language) => {
    close()
    setLanguage(next)
  }

  return (
    <>
      <Pressable
        ref={button}
        onPress={open}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`${t.language.switchLabel}: ${current.name}`}
        accessibilityState={{ expanded: !!anchor }}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: background ?? theme.surface, opacity: pressed ? 0.7 : 1 },
          style,
        ]}>
        <GlobeIcon color={theme.text} size={15} weight={1.5} />
        <AppText style={[styles.buttonText, { color: theme.text }]}>{current.name}</AppText>
        <ChevronDownIcon color={theme.textSecondary} size={6} />
      </Pressable>

      <Modal visible={!!anchor} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={t.common.close} />
        {anchor && (
          <View
            accessibilityRole="menu"
            style={[
              styles.menu,
              {
                top: anchor.y + anchor.height + 6,
                // Lines up with the button's right edge, so it stays on screen at the top right.
                right: Math.max(8, windowWidth - anchor.x - anchor.width),
                backgroundColor: theme.surface,
                borderColor: theme.hairline,
              },
            ]}>
            {LANGUAGES.map((option, index) => {
              const selected = option.value === language
              return (
                <Pressable
                  key={option.value}
                  onPress={() => pick(option.value)}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected }}
                  aria-checked={selected}
                  style={({ pressed }) => [
                    styles.item,
                    index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.hairline },
                    pressed && { backgroundColor: theme.primaryTint },
                  ]}>
                  <AppText style={[styles.itemText, { color: theme.text }, selected && styles.selected]}>
                    {option.name}
                  </AppText>
                  {selected && <CheckIcon color={theme.primary} size={16} weight={2.2} />}
                </Pressable>
              )
            })}
          </View>
        )}
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: 16,
  },
  buttonText: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  menu: {
    position: 'absolute',
    minWidth: 160,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    boxShadow: '0 10px 30px rgba(16, 24, 27, 0.18)',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 46,
    paddingHorizontal: 16,
  },
  itemText: { fontSize: 16, lineHeight: 21 },
  selected: { fontWeight: '600' },
})
