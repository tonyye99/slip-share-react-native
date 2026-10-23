import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native'

import { EyeIcon } from '@/components/icons'
import { AppText } from '@/components/ui'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'

/**
 * A labelled box for the signed-out screens. `action` sits at the right of the label (like "Forgot?"),
 * and `secureTextEntry` adds an eye button to show what was typed.
 */
export function AuthField({
  label,
  action,
  secureTextEntry,
  style,
  ...rest
}: TextInputProps & { label: string; action?: ReactNode }) {
  const theme = useTheme()
  const t = useT()
  const [shown, setShown] = useState(false)
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <AppText style={[styles.label, { color: theme.text }]}>{label}</AppText>
        {action}
      </View>
      <View style={[styles.box, { backgroundColor: theme.background, borderColor: theme.hairline }]}>
        <TextInput
          placeholderTextColor={theme.textSecondary}
          secureTextEntry={secureTextEntry && !shown}
          style={[styles.input, { color: theme.text }, style]}
          accessibilityLabel={label}
          {...rest}
        />
        {secureTextEntry && (
          <Pressable
            onPress={() => setShown((s) => !s)}
            hitSlop={8}
            style={styles.eye}
            accessibilityRole="button"
            accessibilityLabel={shown ? t.auth.hidePassword : t.auth.showPassword}>
            <EyeIcon color={theme.textSecondary} off={shown} />
          </Pressable>
        )}
      </View>
    </View>
  )
}

/** The small blue link at the right of a field's label. */
export function FieldAction({ title, onPress }: { title: string; onPress: () => void }) {
  const theme = useTheme()
  return (
    <AppText style={[styles.label, { color: theme.primary }]} onPress={onPress} accessibilityRole="link" suppressHighlighting>
      {title}
    </AppText>
  )
}

const styles = StyleSheet.create({
  field: { gap: 5 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  box: { flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 12, borderWidth: 1.5 },
  input: { flex: 1, alignSelf: 'stretch', paddingHorizontal: 15, fontSize: 16, minWidth: 0 },
  eye: { paddingLeft: 4, paddingRight: 14, alignSelf: 'stretch', justifyContent: 'center' },
})
