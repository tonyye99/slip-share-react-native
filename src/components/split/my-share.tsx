import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { Avatar } from '@/components/chip'
import { CheckIcon, CloseIcon } from '@/components/icons'
import { AppText, Button, Card, Input, Stepper, TextLink } from '@/components/ui'
import { Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'
import { bothNames, cleanName } from '@/lib/names'
import { isCountable } from '@/lib/split'
import { partOf, type Item, type Money } from '@/lib/split-view'

const MAX_SPLIT = 99

export interface PayerPill {
  id: string
  name: string
  color: string
}

export function WhoPaidCard({
  payers,
  busy,
  onAdd,
  onRemove,
}: {
  payers: PayerPill[]
  busy: boolean
  onAdd: (name: string) => void
  onRemove: (id: string) => void
}) {
  const theme = useTheme()
  const all = useT()
  const t = all.mine
  const [typing, setTyping] = useState(false)
  const [typed, setTyped] = useState('')
  const submit = () => {
    const name = cleanName(typed)
    if (!name || busy) return
    onAdd(name)
    setTyped('')
    setTyping(false)
  }
  return (
    <Card style={styles.card}>
      <AppText variant="caption" style={styles.label}>
        {t.whoPaid.toUpperCase()}
      </AppText>
      {payers.length > 0 && (
        <View style={styles.pills}>
          {payers.map((payer) => (
            <View key={payer.id} style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>
              <Avatar name={payer.name} color={payer.color} size={26} />
              <AppText variant="label" numberOfLines={1} style={styles.pillName}>
                {payer.name}
              </AppText>
              <Pressable
                onPress={() => onRemove(payer.id)}
                disabled={busy}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t.removeName(payer.name)}
                style={({ pressed }) => [styles.pillRemove, { opacity: pressed ? 0.5 : 1 }]}>
                <CloseIcon color={theme.textSecondary} size={11} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {typing || payers.length === 0 ? (
        <View style={styles.typing}>
          <Input
            value={typed}
            onChangeText={setTyped}
            placeholder={t.typeName}
            accessibilityLabel={t.whoPaid}
            autoCapitalize="words"
            autoFocus={typing}
            returnKeyType="done"
            onSubmitEditing={submit}
            maxLength={40}
            style={styles.flex}
          />
          <Button title={all.common.add} onPress={submit} disabled={!cleanName(typed) || busy} />
        </View>
      ) : (
        <TextLink title={t.addPayer} onPress={() => setTyping(true)} />
      )}
    </Card>
  )
}

export function PaidBanner({
  payer,
  amount,
  date,
  onUndo,
}: {
  payer: string
  amount: string
  date: string
  onUndo: () => void
}) {
  const theme = useTheme()
  const all = useT()
  return (
    <View style={[styles.banner, { backgroundColor: theme.successSoft }]}>
      <View style={[styles.bannerIcon, { backgroundColor: theme.success }]}>
        <CheckIcon color={theme.surface} size={16} weight={2.6} />
      </View>
      <View style={styles.flex}>
        <AppText variant="label" style={{ color: theme.success }}>
          {all.split.youPaidBack(payer)}
        </AppText>
        <AppText variant="caption">{all.mine.paidOn(amount, date)}</AppText>
      </View>
      <TextLink title={all.mine.undo} onPress={onUndo} />
    </View>
  )
}

export function MyItemRow({
  item,
  showEnglish,
  units,
  splitBetween,
  share,
  money,
  onToggle,
  onUnits,
  onSplit,
}: {
  item: Item
  showEnglish: boolean
  units: number | null
  splitBetween: number
  share: number
  money: Money
  onToggle: () => void
  onUnits: (units: number) => void
  onSplit: (people: number) => void
}) {
  const theme = useTheme()
  const all = useT()
  const t = all.mine
  const ticked = units !== null
  const names = bothNames(item.name, item.name_en, showEnglish)
  const lineTotal = item.qty * item.unit_price
  const caption = [names.other, item.qty !== 1 ? `${item.qty} × ${money(item.unit_price)}` : null].filter(Boolean).join(' · ')
  const part = ticked ? partOf(item, share) : ''
  const countable = isCountable(item)
  return (
    <View
      style={[
        styles.item,
        { backgroundColor: ticked ? theme.primaryTint : theme.surface, borderTopColor: theme.hairline },
      ]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: ticked }}
        accessibilityLabel={[names.main, money(ticked ? share : lineTotal), part].filter(Boolean).join(', ')}
        style={({ pressed }) => [styles.itemTop, pressed && { opacity: 0.7 }]}>
        <View
          style={[
            styles.check,
            ticked ? { backgroundColor: theme.primary, borderColor: theme.primary } : { borderColor: theme.border },
          ]}>
          {ticked && <CheckIcon color={theme.onPrimary} size={13} weight={3} />}
        </View>
        <View style={styles.flex}>
          <AppText variant="heading" numberOfLines={2}>
            {names.main}
          </AppText>
          {caption ? <AppText variant="caption">{caption}</AppText> : null}
        </View>
        <View style={styles.right}>
          <AppText variant="heading" style={styles.amount}>
            {money(ticked ? share : lineTotal)}
          </AppText>
          {part ? <AppText variant="caption">{part}</AppText> : null}
        </View>
      </Pressable>
      {ticked && countable && (
        <View style={styles.extra}>
          <AppText variant="muted" style={styles.flex}>
            {t.howMany}
          </AppText>
          <Stepper value={units} max={item.qty} onChange={onUnits} label={names.main} />
          <AppText variant="muted">{t.ofQty(item.qty)}</AppText>
        </View>
      )}
      {ticked && !countable && splitBetween > 1 && (
        <View style={styles.extra}>
          <AppText variant="muted" style={styles.flex}>
            {t.splitBetween}
          </AppText>
          <Stepper value={splitBetween} max={MAX_SPLIT} onChange={onSplit} label={t.people} />
          <AppText variant="muted">{t.people}</AppText>
        </View>
      )}
      {ticked && !countable && splitBetween <= 1 && (
        <View style={styles.extra}>
          <TextLink title={t.sharedIt} onPress={() => onSplit(2)} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  amount: { fontVariant: ['tabular-nums'] },
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.large + 4 },
  label: { fontWeight: '700', letterSpacing: 0.5 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two - 2,
    minHeight: 38,
    maxWidth: '100%',
    borderRadius: Radius.pill,
    paddingLeft: Spacing.one + 2,
    paddingRight: Spacing.one + 2,
  },
  pillName: { flexShrink: 1 },
  pillRemove: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  typing: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    padding: Spacing.three,
    borderRadius: Radius.large + 4,
  },
  bannerIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  item: { borderTopWidth: StyleSheet.hairlineWidth },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three - 3,
  },
  right: { alignItems: 'flex-end', maxWidth: 150 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.three + 24 + Spacing.three - 4,
    paddingRight: Spacing.three,
    paddingBottom: Spacing.three - 2,
  },
})
