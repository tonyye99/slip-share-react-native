import { Redirect, router } from 'expo-router'
import { useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'

import { ScreenHeader } from '@/components/screen-header'
import { AppText, Button, Card, Divider, Row, TextField } from '@/components/ui'
import { MaxContentWidth, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'
import { useUserId } from '@/lib/auth'
import { receiptDraft } from '@/lib/draft'
import {
  amountsOf,
  hasErrors,
  itemErrors,
  newItemInput,
  toItemInputs,
  toParsedItems,
  type ItemInput,
} from '@/lib/item-edits'
import { createReceipt } from '@/lib/receipts'
import { billTotal, formatMoney, receiptSubtotal } from '@/lib/split'

// iOS's decimal pad has no minus key, which discount lines need.
const PRICE_KEYBOARD = Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'

export default function ReviewScreen() {
  const theme = useTheme()
  const t = useT()
  const userId = useUserId()
  const [draft] = useState(receiptDraft.get)
  const [items, setItems] = useState(() => toItemInputs(draft?.items ?? []))
  const [editing, setEditing] = useState(false)
  const [edited, setEdited] = useState(false)
  // Field errors show once you try to leave edit mode or save, not while typing.
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!draft) return <Redirect href="/" />

  const money = (amount: number) => formatMoney(amount, draft.currency || 'THB')
  const subtotal = receiptSubtotal(items.map(amountsOf))
  const service = (subtotal * draft.service_percent) / 100
  const tax = (subtotal * draft.tax_percent) / 100
  const itemsTotal = billTotal(draft, subtotal)
  // Once you change the items, the total follows them rather than the printed one.
  const total = edited ? itemsTotal : draft.total
  const doesNotAddUp = draft.total > 0 && Math.abs(itemsTotal - draft.total) >= 0.5
  const showEnglish = draft.original_language !== 'en'

  const updateItem = (key: string, change: Partial<ItemInput>) => {
    setEdited(true)
    setItems((prev) =>
      prev.map((item) =>
        item.key !== key ? item : { ...item, ...change, ...('name' in change ? { name_en: undefined } : {}) },
      ),
    )
  }
  const removeItem = (key: string) => {
    setEdited(true)
    setItems((prev) => prev.filter((item) => item.key !== key))
  }
  const addItem = () => {
    setEdited(true)
    setItems((prev) => [...prev, newItemInput()])
  }
  const finishEditing = () => {
    if (toParsedItems(items)) {
      setEditing(false)
      setShowErrors(false)
      setError(null)
    } else {
      setShowErrors(true)
    }
  }

  const save = async () => {
    const parsedItems = toParsedItems(items)
    if (!parsedItems) {
      setEditing(true)
      setShowErrors(true)
      setError(items.length === 0 ? t.review.addOneItem : t.review.fixMarked)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const id = await createReceipt({ ...draft, items: parsedItems, total }, userId)
      receiptDraft.clear()
      router.replace(`/receipts/${id}`)
    } catch (e) {
      console.error('Save failed', e)
      setError(t.review.saveFailed)
      setSaving(false)
    }
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
    <ScreenHeader
      title={draft.merchant_name || t.common.receipt}
      subtitle={[
        showEnglish && draft.merchant_name_en ? draft.merchant_name_en : null,
        t.common.items(items.length),
        draft.currency,
        draft.original_language ? draft.original_language.toUpperCase() : null,
      ]
        .filter(Boolean)
        .join(' · ')}
    />
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      <View style={styles.header}>
        <AppText variant="overline">{t.review.overline}</AppText>
        <AppText variant="title">{t.review.title}</AppText>
        <AppText variant="muted">{t.review.subtitle}</AppText>
      </View>

      <Card>
        <View style={styles.cardHeader}>
          <AppText variant="heading" style={styles.flex}>
            {t.review.items}
          </AppText>
          <Button
            title={editing ? t.common.done : t.common.edit}
            size="small"
            variant="secondary"
            onPress={editing ? finishEditing : () => setEditing(true)}
          />
        </View>
        {items.map((item) => {
          const { qty, unit_price } = amountsOf(item)
          if (!editing) {
            return (
              <View key={item.key} style={styles.item}>
                <View style={styles.flex}>
                  <AppText variant="label">{item.name}</AppText>
                  <AppText variant="caption">
                    {showEnglish && item.name_en && item.name_en !== item.name ? `${item.name_en} · ` : ''}
                    {qty} × {money(unit_price)}
                  </AppText>
                </View>
                <AppText variant="label" style={styles.amount}>
                  {money(qty * unit_price)}
                </AppText>
              </View>
            )
          }
          const errors = showErrors ? itemErrors(item) : {}
          return (
            <View key={item.key} style={[styles.editItem, { borderColor: theme.border }]}>
              <TextField
                label={t.review.name}
                value={item.name}
                onChangeText={(name) => updateItem(item.key, { name })}
                placeholder={t.review.namePlaceholder}
              />
              <View style={styles.editRow}>
                <View style={styles.qtyField}>
                  <TextField
                    label={t.review.qty}
                    value={item.qty}
                    onChangeText={(text) => updateItem(item.key, { qty: text })}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.flex}>
                  <TextField
                    label={t.review.priceEach}
                    value={item.unit_price}
                    onChangeText={(text) => updateItem(item.key, { unit_price: text })}
                    keyboardType={PRICE_KEYBOARD}
                    placeholder="0.00"
                  />
                </View>
              </View>
              {hasErrors(errors) && (
                <AppText variant="error">{[errors.name, errors.qty, errors.unit_price].filter(Boolean).join(' · ')}</AppText>
              )}
              <Pressable onPress={() => removeItem(item.key)} hitSlop={8} accessibilityRole="button">
                <AppText variant="label" style={{ color: theme.danger }}>
                  {t.review.removeItem}
                </AppText>
              </Pressable>
            </View>
          )
        })}
        {editing && showErrors && items.length === 0 && <AppText variant="error">{t.review.addOneItem}</AppText>}
        {editing && <Button title={t.review.addItem} variant="secondary" onPress={addItem} />}
      </Card>

      <Card>
        <Row label={t.common.subtotal} value={money(subtotal)} />
        {service > 0 && <Row label={t.common.service(draft.service_percent)} value={money(service)} />}
        {tax > 0 && <Row label={t.common.vat(draft.tax_percent)} value={money(tax)} />}
        {draft.rounding !== 0 && <Row label={t.common.rounding} value={money(draft.rounding)} />}
        <Divider />
        <Row label={t.common.total} value={money(total)} bold />
        {doesNotAddUp && (
          <AppText variant="caption" style={{ color: theme.warning }}>
            {edited
              ? t.review.editedTotal(money(draft.total), money(itemsTotal))
              : t.review.doesntAddUp(money(itemsTotal), money(draft.total))}
          </AppText>
        )}
      </Card>

      {error && <AppText variant="error">{error}</AppText>}

      <Button title={t.review.continue} onPress={save} loading={saving} />
      <Button title={t.review.startOver} variant="secondary" onPress={() => router.replace('/scan')} disabled={saving} />
    </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { gap: Spacing.one },
  flex: { flex: 1 },
  item: { flexDirection: 'row', gap: Spacing.three, paddingVertical: Spacing.one },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  editItem: { gap: Spacing.two, paddingVertical: Spacing.three - 4, borderBottomWidth: StyleSheet.hairlineWidth },
  editRow: { flexDirection: 'row', gap: Spacing.two },
  qtyField: { width: 88 },
  amount: { fontVariant: ['tabular-nums'] },
})
