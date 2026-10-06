import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { AppText, Button } from '@/components/ui'
import { Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

interface LinkStatusProps {
  error: string | null
  progressMessage: string
  errorActionTitle: string
  onErrorAction: () => void
}

/** Full-screen spinner, or an error with a way out, for screens opened from a link. */
export function LinkStatus({ error, progressMessage, errorActionTitle, onErrorAction }: LinkStatusProps) {
  const theme = useTheme()
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {error ? (
        <>
          <AppText variant="error" style={styles.center}>
            {error}
          </AppText>
          <Button title={errorActionTitle} variant="secondary" onPress={onErrorAction} />
        </>
      ) : (
        <>
          <ActivityIndicator />
          <AppText variant="muted">{progressMessage}</AppText>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  center: { textAlign: 'center' },
})
