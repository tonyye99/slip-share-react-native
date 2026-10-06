import { Redirect, router } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'

import { AppText, Button, Card, Row } from '@/components/ui'
import { MaxContentWidth, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useUserId } from '@/lib/auth'
import { receiptDraft } from '@/lib/draft'
import { createReceipt } from '@/lib/receipts'
import { formatMoney, receiptSubtotal } from '@/lib/split'
import type { UserType } from '@/lib/types'

const ROLES: { value: UserType; title: string; description: string }[] = [
  { value: 'payer', title: 'I paid this bill', description: 'See what you consumed from the bill you paid.' },
  { value: 'sharer', title: 'Someone else paid', description: 'Work out how much you owe.' },
]

export default function ReviewScreen() {
  const theme = useTheme()
  const userId = useUserId()
  const [draft] = useState(receiptDraft.get)
  const [userType, setUserType] = useState<UserType>('sharer')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!draft) return <Redirect href="/" />

  const money = (amount: number) => formatMoney(amount, draft.currency || 'THB')
  const subtotal = receiptSubtotal(draft.items)
  const service = (subtotal * draft.service_percent) / 100
  const tax = (subtotal * draft.tax_percent) / 100
  const showEnglish = draft.original_language !== 'en'

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const id = await createReceipt(draft, userType, userId)
      receiptDraft.clear()
      router.replace(`/receipts/${id}`)
    } catch (e) {
      console.error('Save failed', e)
      setError('Could not save the receipt. Please try again.')
      setSaving(false)
    }
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="title">{draft.merchant_name || 'Receipt'}</AppText>
        {showEnglish && draft.merchant_name_en ? <AppText variant="muted">{draft.merchant_name_en}</AppText> : null}
        <AppText variant="muted">
          {draft.items.length} item{draft.items.length === 1 ? '' : 's'} · {draft.currency}
          {draft.original_language ? ` · ${draft.original_language.toUpperCase()}` : ''}
        </AppText>
      </View>

      <Card>
        {draft.items.map((item, i) => (
          <View key={`${item.id}-${i}`} style={styles.item}>
            <View style={styles.flex}>
              <AppText>{item.name}</AppText>
              {showEnglish && item.name_en && item.name_en !== item.name ? (
                <AppText variant="muted">{item.name_en}</AppText>
              ) : null}
              <AppText variant="muted">
                {item.qty} × {money(item.unit_price)}
              </AppText>
            </View>
            <AppText style={styles.amount}>{money(item.qty * item.unit_price)}</AppText>
          </View>
        ))}
      </Card>

      <Card>
        <Row label="Subtotal" value={money(subtotal)} />
        {service > 0 && <Row label={`Service (${draft.service_percent}%)`} value={money(service)} />}
        {tax > 0 && <Row label={`Tax (${draft.tax_percent}%)`} value={money(tax)} />}
        {draft.rounding !== 0 && <Row label="Rounding" value={money(draft.rounding)} />}
        <Row label="Total" value={money(draft.total)} bold />
      </Card>

      <AppText variant="heading">Who paid this bill?</AppText>
      {ROLES.map((role) => {
        const selected = role.value === userType
        return (
          <Pressable
            key={role.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => setUserType(role.value)}>
            <Card style={[styles.role, { borderColor: selected ? theme.primary : 'transparent' }]}>
              <AppText variant="label">{role.title}</AppText>
              <AppText variant="muted">{role.description}</AppText>
            </Card>
          </Pressable>
        )
      })}

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
  amount: { fontVariant: ['tabular-nums'] },
  role: { borderWidth: 2, gap: Spacing.one },
})
