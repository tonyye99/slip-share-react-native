import { Redirect, router } from 'expo-router'
import { useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'

import { AppText, Button, Card, Row, TextField } from '@/components/ui'
import { MaxContentWidth, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
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
      setError(items.length === 0 ? 'Add at least one item.' : 'Fix the items marked above first.')
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
      setError('Could not save the receipt. Please try again.')
      setSaving(false)
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      <View style={styles.header}>
        <AppText variant="title">{draft.merchant_name || 'Receipt'}</AppText>
        {showEnglish && draft.merchant_name_en ? <AppText variant="muted">{draft.merchant_name_en}</AppText> : null}
        <AppText variant="muted">
          {items.length} item{items.length === 1 ? '' : 's'} · {draft.currency}
          {draft.original_language ? ` · ${draft.original_language.toUpperCase()}` : ''}
        </AppText>
      </View>

      <Card>
        <View style={styles.cardHeader}>
          <AppText variant="heading" style={styles.flex}>
            Items
          </AppText>
          <Pressable onPress={editing ? finishEditing : () => setEditing(true)} hitSlop={8} accessibilityRole="button">
            <AppText variant="label" style={{ color: theme.primary }}>
              {editing ? 'Done' : 'Edit'}
            </AppText>
          </Pressable>
        </View>
        {items.map((item) => {
          const { qty, unit_price } = amountsOf(item)
          if (!editing) {
            return (
              <View key={item.key} style={styles.item}>
                <View style={styles.flex}>
                  <AppText>{item.name}</AppText>
                  {showEnglish && item.name_en && item.name_en !== item.name ? (
                    <AppText variant="muted">{item.name_en}</AppText>
                  ) : null}
                  <AppText variant="muted">
                    {qty} × {money(unit_price)}
                  </AppText>
                </View>
                <AppText style={styles.amount}>{money(qty * unit_price)}</AppText>
              </View>
            )
          }
          const errors = showErrors ? itemErrors(item) : {}
          return (
            <View key={item.key} style={[styles.editItem, { borderColor: theme.border }]}>
              <TextField
                label="Name"
                value={item.name}
                onChangeText={(name) => updateItem(item.key, { name })}
                placeholder="What it says on the receipt"
              />
              <View style={styles.editRow}>
                <View style={styles.qtyField}>
                  <TextField
                    label="Qty"
                    value={item.qty}
                    onChangeText={(text) => updateItem(item.key, { qty: text })}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.flex}>
                  <TextField
                    label="Price each"
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
                  Remove item
                </AppText>
              </Pressable>
            </View>
          )
        })}
        {editing && showErrors && items.length === 0 && <AppText variant="error">Add at least one item.</AppText>}
        {editing && <Button title="Add item" variant="secondary" onPress={addItem} />}
      </Card>

      <Card>
        <Row label="Subtotal" value={money(subtotal)} />
        {service > 0 && <Row label={`Service (${draft.service_percent}%)`} value={money(service)} />}
        {tax > 0 && <Row label={`Tax (${draft.tax_percent}%)`} value={money(tax)} />}
        {draft.rounding !== 0 && <Row label="Rounding" value={money(draft.rounding)} />}
        <Row label="Total" value={money(total)} bold />
        {doesNotAddUp && (
          <AppText variant="muted">
            {edited
              ? `The receipt's printed total is ${money(draft.total)}. ` +
                `Saving uses ${money(itemsTotal)}, the total of these items.`
              : `These items add up to ${money(itemsTotal)}, not the ${money(draft.total)} printed on the receipt. ` +
                'Tap Edit to fix a misread item.'}
          </AppText>
        )}
      </Card>

      {error && <AppText variant="error">{error}</AppText>}

      <Button title="Continue" onPress={save} loading={saving} />
      <Button title="Start over" variant="secondary" onPress={() => router.replace('/scan')} disabled={saving} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { gap: Spacing.one },
  flex: { flex: 1 },
  item: { flexDirection: 'row', gap: Spacing.three, paddingVertical: Spacing.one },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  editItem: { gap: Spacing.two, paddingBottom: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth },
  editRow: { flexDirection: 'row', gap: Spacing.two },
  qtyField: { width: 88 },
  amount: { fontVariant: ['tabular-nums'] },
})
