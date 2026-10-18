import { StyleSheet, View } from 'react-native'

import { SplitIllustration } from '@/components/home/illustration'
import { AppText, Card } from '@/components/ui'
import { Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

const STEPS = ['Snap the receipt', 'Tap who had what', 'Send totals to the group']

/** Home before the first bill: what SlipShare does, in three steps. */
export function FirstTime() {
  const theme = useTheme()
  return (
    <View style={styles.wrap}>
      <Card style={styles.hero}>
        <SplitIllustration />
        <View style={styles.heroText}>
          <AppText variant="title" style={styles.title} accessibilityRole="header">
            Split a bill in a minute
          </AppText>
          <AppText variant="muted" style={styles.subtitle}>
            No more calculators at the table.
          </AppText>
        </View>
      </Card>
      <View style={styles.steps}>
        {STEPS.map((step, index) => (
          <Card key={step} style={styles.step}>
            <View style={[styles.number, { backgroundColor: theme.primarySoft }]}>
              <AppText variant="caption" style={[styles.numberText, { color: theme.primary }]}>
                {index + 1}
              </AppText>
            </View>
            <AppText variant="label" style={styles.stepText}>
              {step}
            </AppText>
          </Card>
        ))}
      </View>
      <AppText variant="caption" style={styles.center}>
        Your bills will show up here.
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three + 2 },
  hero: { borderRadius: Radius.large + 8, paddingTop: Spacing.five - 2, paddingBottom: Spacing.four, gap: Spacing.three + 2 },
  heroText: { alignItems: 'center', gap: Spacing.two + 2 },
  title: { textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { textAlign: 'center', fontSize: 15 },
  steps: { flexDirection: 'row', gap: Spacing.two + 2 },
  step: { flex: 1, borderRadius: Radius.large + 2, padding: Spacing.three - 4, gap: Spacing.three - 4, minHeight: 102 },
  number: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontSize: 14, fontWeight: '700' },
  stepText: { fontSize: 14, lineHeight: 18 },
  center: { textAlign: 'center', marginTop: -2 },
})
