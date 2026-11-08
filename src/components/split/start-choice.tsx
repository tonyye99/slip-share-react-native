import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { ChevronRight, PeopleIcon, PersonIcon } from '@/components/icons'
import { AppText } from '@/components/ui'
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'
import type { SplitMode } from '@/lib/types'

export function StartChoice({ onChoose }: { onChoose: (mode: SplitMode) => void }) {
  const theme = useTheme()
  const t = useT().mine
  const option = (mode: SplitMode, title: string, hint: string, icon: ReactNode, first: boolean) => (
    <Pressable
      onPress={() => onChoose(mode)}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: pressed ? theme.backgroundElement : theme.surface,
          borderColor: first ? theme.primary : theme.hairline,
        },
      ]}>
      <View style={[styles.icon, { backgroundColor: theme.primaryTint }]}>{icon}</View>
      <View style={styles.flex}>
        <AppText variant="heading">{title}</AppText>
        <AppText variant="muted" style={{ color: theme.textSecondary }}>
          {hint}
        </AppText>
      </View>
      <ChevronRight color={theme.textSecondary} />
    </Pressable>
  )
  return (
    <View style={styles.content}>
      <AppText variant="title">{t.question}</AppText>
      {option('mine', t.justMine, t.justMineHint, <PersonIcon color={theme.primary} size={20} />, true)}
      {option('everyone', t.everyone, t.everyoneHint, <PeopleIcon color={theme.primary} size={22} />, false)}
      <AppText variant="caption" style={styles.note}>
        {t.changeLater}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    padding: Spacing.three,
    borderRadius: Radius.large + 4,
    borderWidth: 2,
  },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  note: { textAlign: 'center', marginTop: Spacing.one },
})
