import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { AppText } from '@/components/ui'
import { useTheme } from '@/hooks/use-theme'
import { useLanguage, useT, type Language } from '@/i18n'

const OPTIONS: { value: Language; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'th', label: 'ไทย' },
]

/** EN | ไทย in a pill. The picked one is dark. Changes the app's language right away. */
export function LanguageSwitch({ track, style }: { track?: string; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme()
  const t = useT()
  const { language, setLanguage } = useLanguage()
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t.language.switchLabel}
      style={[styles.track, { backgroundColor: track ?? theme.surface }, style]}>
      {OPTIONS.map((option) => {
        const selected = option.value === language
        return (
          <Pressable
            key={option.value}
            onPress={() => setLanguage(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            aria-checked={selected}
            accessibilityLabel={option.value === 'en' ? 'English' : 'ภาษาไทย'}
            hitSlop={4}
            style={[styles.option, selected && { backgroundColor: theme.text }]}>
            <AppText style={[styles.label, { color: selected ? theme.surface : theme.textSecondary }]}>{option.label}</AppText>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', height: 37, padding: 3, borderRadius: 18.5 },
  option: { minWidth: 44, paddingHorizontal: 10, borderRadius: 15.5, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
})
