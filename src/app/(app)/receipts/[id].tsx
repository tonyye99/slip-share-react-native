import { useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ShareStepper } from '@/components/share-stepper'
import { AppText, Button, Card, Row } from '@/components/ui'
import { MaxContentWidth, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useUserId } from '@/lib/auth'
import { getReceipt, saveSelection } from '@/lib/receipts'
import { calculateSplit, formatMoney, itemShare } from '@/lib/split'
import type { ReceiptWithItems, ShareCounts, UserSelection } from '@/lib/types'

export default function SplitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const theme = useTheme()
  const userId = useUserId()
  const [receipt, setReceipt] = useState<ReceiptWithItems | null>(null)
  const [selection, setSelection] = useState<UserSelection | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [shares, setShares] = useState<ShareCounts>({})
  const [english, setEnglish] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getReceipt(id, userId)
      .then(({ receipt, selection }) => {
        setReceipt(receipt)
        setSelection(selection)
        setSelected(selection?.selected_items ?? [])
        setShares(selection?.item_shares ?? {})
      })
      .catch((e) => {
        console.error('Load failed', e)
        setError("This receipt doesn't exist or you don't have access to it.")
      })
  }, [id, userId])

  const split = useMemo(
    () => (receipt ? calculateSplit(receipt, receipt.receipts_items, selected, shares) : null),
    [receipt, selected, shares],
  )

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <AppText variant="error">{error}</AppText>
      </View>
    )
  }
  if (!receipt || !split) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator />
      </View>
    )
  }

  const money = (amount: number) => formatMoney(amount, receipt.currency)
  const isPayer = receipt.user_type === 'payer'
  const hasTranslation = !!receipt.merchant_name_en || receipt.receipts_items.some((i) => i.name_en)
  const display = (original: string | null, en: string | null) => (english && en ? en : original || en || '')

  const toggle = (itemId: string) =>
    setSelected((prev) => (prev.includes(itemId) ? prev.filter((x) => x !== itemId) : [...prev, itemId]))

  const save = async () => {
    setSaving(true)
    try {
      setSelection(await saveSelection(receipt, userId, selected, shares))
      Alert.alert('Saved', isPayer ? 'Your consumption has been saved.' : 'Your share has been saved.')
    } catch (e) {
      console.error('Save failed', e)
      Alert.alert('Could not save', 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <AppText variant="title">{display(receipt.merchant_name, receipt.merchant_name_en) || 'Receipt'}</AppText>
          <AppText variant="muted">
            {isPayer ? 'You paid' : 'Someone else paid'} · Total {money(receipt.total)}
          </AppText>
        </View>

        {hasTranslation && (
          <Card style={styles.toggle}>
            <AppText variant="label" style={styles.flex}>
              Show English names
            </AppText>
            <Switch value={english} onValueChange={setEnglish} />
          </Card>
        )}

        <AppText variant="muted">Tap what you had. If you shared a dish, set how many people split it.</AppText>

        {receipt.receipts_items.map((item) => {
          const isSelected = selected.includes(item.id)
          const count = shares[item.id] || 1
          return (
            <Pressable
              key={item.id}
              onPress={() => toggle(item.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}>
              <Card style={[styles.item, { borderColor: isSelected ? theme.primary : 'transparent' }]}>
                <View style={styles.itemRow}>
                  <View
                    style={[
                      styles.check,
                      { borderColor: isSelected ? theme.primary : theme.textSecondary },
                      isSelected && { backgroundColor: theme.primary },
                    ]}>
                    {isSelected && <AppText style={{ color: theme.onPrimary, lineHeight: 18 }}>✓</AppText>}
                  </View>
                  <View style={styles.flex}>
                    <AppText>{display(item.name, item.name_en)}</AppText>
                    <AppText variant="muted">
                      {item.qty} × {money(item.unit_price)}
                    </AppText>
                  </View>
                  <AppText style={styles.amount}>
                    {money(isSelected ? itemShare(item, count) : item.qty * item.unit_price)}
                  </AppText>
                </View>
                {isSelected && (
                  <ShareStepper value={count} onChange={(value) => setShares((prev) => ({ ...prev, [item.id]: value }))} />
                )}
              </Card>
            </Pressable>
          )
        })}
      </ScrollView>

      <View style={[styles.summary, { backgroundColor: theme.background, borderColor: theme.border }]}>
        {selected.length > 0 && (
          <>
            <Row label="Your items" value={money(split.subtotal)} />
            {receipt.service_percent > 0 && <Row label={`Service (${receipt.service_percent}%)`} value={money(split.service)} />}
            {receipt.tax_percent > 0 && <Row label={`Tax (${receipt.tax_percent}%)`} value={money(split.tax)} />}
            {Math.abs(split.rounding) > 0.001 && <Row label="Rounding" value={money(split.rounding)} />}
          </>
        )}
        <Row label={isPayer ? 'Your consumption' : 'You owe'} value={money(split.total)} bold />
        <AppText variant="muted">
          {(split.proportion * 100).toFixed(1)}% of the bill
          {selection ? ` · Last saved ${new Date(selection.updated_at).toLocaleDateString()}` : ''}
        </AppText>
        <Button title={isPayer ? 'Save your consumption' : 'Save your share'} onPress={save} loading={saving} />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  content: { padding: Spacing.three, gap: Spacing.two, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { gap: Spacing.one, marginBottom: Spacing.two },
  toggle: { flexDirection: 'row', alignItems: 'center' },
  item: { borderWidth: 2 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  check: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  amount: { fontVariant: ['tabular-nums'] },
  summary: {
    padding: Spacing.three,
    gap: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
})
