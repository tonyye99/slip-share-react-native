import { Pressable, StyleSheet, View } from 'react-native'

import { ChevronRight } from '@/components/icons'
import { Sheet } from '@/components/sheet'
import { Toggle } from '@/components/toggle'
import { AppText, Button, TextField } from '@/components/ui'
import { Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'
import { chargePercent, type ChargeInput } from '@/lib/item-edits'

export type ChargeKind = 'service' | 'tax'

/** "Service 10%  ฿100.00 ›" on the review screen. Tapping it opens the ChargeSheet. */
export function ChargeRow({ label, value, off, onPress }: { label: string; value: string; off: boolean; onPress: () => void }) {
  const theme = useTheme()
  const t = useT()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}, ${t.common.edit}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {/* The chevron sits by the label so the amounts stay lined up with Subtotal and Total. */}
      <View style={styles.labelGroup}>
        <AppText variant="muted" style={styles.shrink}>
          {label}
        </AppText>
        <ChevronRight color={theme.textSecondary} size={7} weight={1.8} />
      </View>
      <AppText variant="muted" style={[styles.amount, !off && styles.medium]}>
        {value}
      </AppText>
    </Pressable>
  )
}

/** Turn the service charge or tax on or off, and change its percent. */
export function ChargeSheet({
  kind,
  visible,
  input,
  amount,
  base,
  withService,
  money,
  onChange,
  onClose,
}: {
  kind: ChargeKind
  visible: boolean
  input: ChargeInput
  /** What the charge comes to. */
  amount: number
  /** What it's charged on: the items, plus the service charge for tax. */
  base: number
  /** Tax is charged on a service charge too, when there is one. */
  withService: boolean
  money: (amount: number) => string
  onChange: (input: ChargeInput) => void
  onClose: () => void
}) {
  const t = useT()
  const percent = chargePercent(input)
  const title = kind === 'service' ? t.review.serviceCharge : t.review.tax
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={kind === 'service' ? t.review.serviceSubtitle : withService ? t.review.taxSubtitle : t.review.taxSubtitleItems}
      footer={<Button title={t.common.done} onPress={onClose} disabled={percent === null} />}>
      <View style={styles.switchRow}>
        <AppText variant="label" style={styles.label}>
          {t.review.addToBill}
        </AppText>
        <Toggle
          value={input.on}
          onValueChange={(on) => onChange({ ...input, on })}
          accessibilityLabel={`${title}: ${t.review.addToBill}`}
        />
      </View>
      {input.on ? (
        <View style={styles.field}>
          <TextField
            label={t.review.percent}
            value={input.percent}
            onChangeText={(text) => onChange({ ...input, percent: text })}
            keyboardType="decimal-pad"
            placeholder={kind === 'service' ? '10' : '7'}
            autoFocus={!input.percent}
          />
          {percent === null ? (
            <AppText variant="error">{t.review.enterPercent}</AppText>
          ) : (
            <AppText variant="caption">
              {kind === 'service'
                ? t.review.serviceAmount(money(amount), money(base))
                : t.review.taxAmount(money(amount), money(base), withService)}
            </AppText>
          )}
        </View>
      ) : (
        <AppText variant="caption" style={styles.field}>
          {t.review.chargeOff}
        </AppText>
      )}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 32 },
  labelGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
  pressed: { opacity: 0.6 },
  label: { flex: 1 },
  amount: { fontVariant: ['tabular-nums'] },
  medium: { fontWeight: '500' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.one, minHeight: 48 },
  field: { gap: Spacing.one, paddingHorizontal: Spacing.one },
})
