import { Stack, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ShareStepper } from '@/components/share-stepper'
import { AppText, Button, Card, Row } from '@/components/ui'
import { MaxContentWidth, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useUserId } from '@/lib/auth'
import {
  getMyPayment,
  getOwnerName,
  getParticipantShares,
  getReceipt,
  saveSelection,
  setParticipantPaid,
} from '@/lib/receipts'
import { shareReceipt } from '@/lib/share'
import { calculateSplit, formatMoney, itemCostPerPerson } from '@/lib/split'
import type { ParticipantShare, Payment, ReceiptWithItems, ShareCounts, UserSelection } from '@/lib/types'

export default function SplitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const theme = useTheme()
  const userId = useUserId()
  const [receipt, setReceipt] = useState<ReceiptWithItems | null>(null)
  const [selection, setSelection] = useState<UserSelection | null>(null)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  const [shareCounts, setShareCounts] = useState<ShareCounts>({})
  const [showEnglish, setShowEnglish] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  // Owner sees everyone's totals; a participant sees who shared the bill.
  const [participants, setParticipants] = useState<ParticipantShare[] | null>(null)
  const [ownerName, setOwnerName] = useState<string | null>(null)
  // A participant's own payment, once the owner marks it.
  const [myPayment, setMyPayment] = useState<Payment | null>(null)
  const [updatingPaymentFor, setUpdatingPaymentFor] = useState<string | null>(null)

  const loadParticipants = useCallback(
    async (receipt: ReceiptWithItems) => {
      if (receipt.user_id === userId) {
        setParticipants(await getParticipantShares(receipt, userId))
      } else {
        const [name, payment] = await Promise.all([getOwnerName(receipt.user_id), getMyPayment(receipt.id, userId)])
        setOwnerName(name)
        setMyPayment(payment)
      }
    },
    [userId],
  )

  useEffect(() => {
    getReceipt(id, userId)
      .then(({ receipt, selection }) => {
        setReceipt(receipt)
        setSelection(selection)
        setSelectedItemIds(selection?.selected_items ?? [])
        setShareCounts(selection?.item_shares ?? {})
        return loadParticipants(receipt)
      })
      .catch((e) => {
        console.error('Load failed', e)
        setError("This receipt doesn't exist or you don't have access to it.")
      })
  }, [id, userId, loadParticipants])

  const refresh = async () => {
    if (!receipt) return
    setRefreshing(true)
    try {
      await loadParticipants(receipt)
    } catch (e) {
      console.error('Refresh failed', e)
    } finally {
      setRefreshing(false)
    }
  }

  const split = useMemo(
    () => (receipt ? calculateSplit(receipt, receipt.receipts_items, selectedItemIds, shareCounts) : null),
    [receipt, selectedItemIds, shareCounts],
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
  const share = () => shareReceipt(receipt.share_token, receipt.merchant_name)
  const isOwner = receipt.user_id === userId
  const isPayer = isOwner && receipt.user_type === 'payer'
  const hasTranslation = !!receipt.merchant_name_en || receipt.receipts_items.some((item) => item.name_en)
  const localizedName = (original: string | null, english: string | null) =>
    showEnglish && english ? english : original || english || ''

  const toggleItem = (itemId: string) =>
    setSelectedItemIds((prev) => (prev.includes(itemId) ? prev.filter((selectedId) => selectedId !== itemId) : [...prev, itemId]))

  const save = async () => {
    setSaving(true)
    try {
      setSelection(await saveSelection(receipt, userId, selectedItemIds, shareCounts))
      if (isOwner) loadParticipants(receipt).catch((e) => console.error('Refresh failed', e))
      Alert.alert('Saved', isPayer ? 'Your consumption has been saved.' : 'Your share has been saved.')
    } catch (e) {
      console.error('Save failed', e)
      Alert.alert('Could not save', 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const togglePaid = async (participant: ParticipantShare) => {
    setUpdatingPaymentFor(participant.user_id)
    try {
      await setParticipantPaid(receipt.id, participant.user_id, !participant.payment)
      await loadParticipants(receipt)
    } catch (e) {
      console.error('Payment update failed', e)
      Alert.alert('Could not update', 'Please try again.')
    } finally {
      setUpdatingPaymentFor(null)
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: theme.background }]}>
      {isOwner && (
        <Stack.Screen
          options={{
            headerRight: () => (
              <Pressable onPress={share} hitSlop={8} accessibilityRole="button">
                <AppText variant="label" style={{ color: theme.primary }}>
                  Share
                </AppText>
              </Pressable>
            ),
          }}
        />
      )}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View style={styles.header}>
          <AppText variant="title">{localizedName(receipt.merchant_name, receipt.merchant_name_en) || 'Receipt'}</AppText>
          <AppText variant="muted">
            {isOwner ? (isPayer ? 'You paid' : 'Someone else paid') : `Shared by ${ownerName ?? '…'}`} · Total{' '}
            {money(receipt.total)}
          </AppText>
        </View>

        {participants && (
          <WhoOwesWhat
            participants={participants}
            total={receipt.total}
            money={money}
            onShare={share}
            // Payments only make sense when the owner paid the bill.
            onTogglePaid={isPayer ? togglePaid : undefined}
            updatingPaymentFor={updatingPaymentFor}
          />
        )}

        {myPayment && (
          <Card>
            <AppText variant="label">✓ {ownerName ?? 'The owner'} marked your share as paid</AppText>
            <AppText variant="muted">
              {money(myPayment.paid_amount)} on {new Date(myPayment.paid_at).toLocaleDateString()}
              {selection && !sameAmount(Number(selection.calculated_total), myPayment.paid_amount)
                ? `. Your saved share is now ${money(Number(selection.calculated_total))}.`
                : ''}
            </AppText>
          </Card>
        )}

        {hasTranslation && (
          <Card style={styles.toggle}>
            <AppText variant="label" style={styles.flex}>
              Show English names
            </AppText>
            <Switch value={showEnglish} onValueChange={setShowEnglish} />
          </Card>
        )}

        <AppText variant="muted">Tap what you had. If you shared a dish, set how many people split it.</AppText>

        {receipt.receipts_items.map((item) => {
          const isSelected = selectedItemIds.includes(item.id)
          const shareCount = shareCounts[item.id] || 1
          return (
            <Pressable
              key={item.id}
              onPress={() => toggleItem(item.id)}
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
                    <AppText>{localizedName(item.name, item.name_en)}</AppText>
                    <AppText variant="muted">
                      {item.qty} × {money(item.unit_price)}
                    </AppText>
                  </View>
                  <AppText style={styles.amount}>
                    {money(isSelected ? itemCostPerPerson(item, shareCount) : item.qty * item.unit_price)}
                  </AppText>
                </View>
                {isSelected && (
                  <ShareStepper value={shareCount} onChange={(value) => setShareCounts((prev) => ({ ...prev, [item.id]: value }))} />
                )}
              </Card>
            </Pressable>
          )
        })}
      </ScrollView>

      <View style={[styles.summary, { backgroundColor: theme.background, borderColor: theme.border }]}>
        {selectedItemIds.length > 0 && (
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

function WhoOwesWhat({
  participants,
  total,
  money,
  onShare,
  onTogglePaid,
  updatingPaymentFor,
}: {
  participants: ParticipantShare[]
  total: number
  money: (amount: number) => string
  onShare: () => void
  /** Set when the owner paid the bill, so they can tick off friends who paid them back. */
  onTogglePaid?: (participant: ParticipantShare) => void
  updatingPaymentFor: string | null
}) {
  const claimed = participants.reduce((sum, participant) => sum + (participant.total ?? 0), 0)
  const unclaimed = total - claimed
  // The owner's own line is first and is never "paid back".
  const friends = participants.slice(1).filter((participant) => participant.total !== null)
  const owedByFriends = friends.reduce((sum, friend) => sum + (friend.total ?? 0), 0)
  const paidBack = friends.reduce((sum, friend) => sum + (friend.payment?.paid_amount ?? 0), 0)

  if (participants.length === 1) {
    return (
      <Card>
        <AppText variant="heading">Split it with friends</AppText>
        <AppText variant="muted">Send them a link. They pick what they had and you see what each person owes.</AppText>
        <Button title="Share link" variant="secondary" onPress={onShare} />
      </Card>
    )
  }

  return (
    <Card>
      <AppText variant="heading">Who owes what</AppText>
      {participants.map((participant, index) => {
        const value = participant.total === null ? 'Not picked yet' : money(participant.total)
        const canMarkPaid = onTogglePaid && index > 0 && participant.total !== null
        if (!canMarkPaid) return <Row key={participant.user_id} label={participant.name} value={value} />
        const { payment } = participant
        return (
          <View key={participant.user_id} style={styles.participant}>
            <View style={styles.participantRow}>
              <AppText variant="muted" style={styles.flex}>
                {participant.name}
              </AppText>
              <AppText style={styles.amount}>{value}</AppText>
              <PaidToggle
                paid={!!payment}
                busy={updatingPaymentFor === participant.user_id}
                onPress={() => onTogglePaid(participant)}
              />
            </View>
            {payment && !sameAmount(payment.paid_amount, participant.total ?? 0) && (
              <AppText variant="muted">
                Paid {money(payment.paid_amount)} before changing their picks
              </AppText>
            )}
          </View>
        )
      })}
      {Math.abs(unclaimed) > 0.005 && <Row label="Not claimed yet" value={money(unclaimed)} />}
      {onTogglePaid && friends.length > 0 && (
        <Row label="Paid back" value={`${money(paidBack)} of ${money(owedByFriends)}`} />
      )}
      <AppText variant="muted">Pull down to refresh.</AppText>
    </Card>
  )
}

function PaidToggle({ paid, busy, onPress }: { paid: boolean; busy: boolean; onPress: () => void }) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityLabel="Paid"
      accessibilityState={{ checked: paid, busy }}
      style={[
        styles.paidToggle,
        { borderColor: theme.primary, backgroundColor: paid ? theme.primary : 'transparent', opacity: busy ? 0.5 : 1 },
      ]}>
      <AppText variant="label" style={{ color: paid ? theme.onPrimary : theme.primary }}>
        {paid ? '✓ Paid' : 'Mark paid'}
      </AppText>
    </Pressable>
  )
}

const sameAmount = (a: number, b: number) => Math.abs(a - b) < 0.005

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
  participant: { gap: Spacing.one },
  participantRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  paidToggle: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    minWidth: 84,
    alignItems: 'center',
  },
  summary: {
    padding: Spacing.three,
    gap: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
})
