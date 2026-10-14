import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Avatar } from '@/components/chip'
import { ScreenHeader } from '@/components/screen-header'
import { SwipeToDelete } from '@/components/swipe-to-delete'
import { AppText, Button, Card } from '@/components/ui'
import { MaxContentWidth, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { showAlert } from '@/lib/alert'
import { useAuth } from '@/lib/auth'
import { confirmDeleteReceipt, deleteReceipt, listReceipts, type ReceiptSummary } from '@/lib/receipts'
import { formatMoney } from '@/lib/split'

const PAGE_SIZE = 20

export default function HomeScreen() {
  const theme = useTheme()
  const { session } = useAuth()
  const [receipts, setReceipts] = useState<ReceiptSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadFirstPage = useCallback(async () => {
    try {
      const page = await listReceipts(0, PAGE_SIZE)
      setReceipts(page.receipts)
      setTotal(page.total)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load receipts')
    } finally {
      setLoading(false)
    }
  }, [])

  // Reload when coming back from a newly saved receipt.
  useFocusEffect(
    useCallback(() => {
      loadFirstPage()
    }, [loadFirstPage]),
  )

  const loadMore = async () => {
    if (loadingMore || receipts.length >= total) return
    setLoadingMore(true)
    try {
      const page = await listReceipts(receipts.length, PAGE_SIZE)
      setReceipts((prev) => [...prev, ...page.receipts])
      setTotal(page.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load receipts')
    } finally {
      setLoadingMore(false)
    }
  }

  const remove = (receipt: ReceiptSummary) =>
    confirmDeleteReceipt(async () => {
      try {
        await deleteReceipt(receipt.id)
        setReceipts((prev) => prev.filter((other) => other.id !== receipt.id))
        setTotal((prev) => prev - 1)
      } catch (e) {
        console.error('Delete receipt failed', e)
        showAlert('Could not delete this receipt', 'Check your connection and try again.')
      }
    })

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: theme.background }]}>
      <ScreenHeader
        brand
        back={false}
        right={
          <Pressable
            onPress={() => router.push('/account')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Account"
            style={styles.account}>
            <AppText variant="label" style={{ color: theme.primary }}>
              Account
            </AppText>
            <Avatar name={session?.user.email ?? '?'} color={theme.primary} size={30} soft />
          </Pressable>
        }
      />
      <FlatList
        data={receipts}
        keyExtractor={(receipt) => receipt.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={false} onRefresh={loadFirstPage} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={styles.header}>
            <Card style={styles.hero}>
              <AppText variant="title">Split a bill</AppText>
              <AppText variant="muted">Take a photo of the receipt. SlipShare reads the items so you can tap who had what.</AppText>
              <Button title="Scan a receipt" onPress={() => router.push('/scan')} style={styles.heroButton} />
            </Card>
            {error && <AppText variant="error">{error}</AppText>}
            {receipts.length > 0 && <AppText variant="heading">Your receipts</AppText>}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator />
          ) : (
            <Card dashed style={styles.empty}>
              <AppText variant="heading">No receipts yet</AppText>
              <AppText variant="muted" style={styles.center}>
                Bills you scan show up here, with who owes what.
              </AppText>
            </Card>
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} /> : null}
        renderItem={({ item }) => <ReceiptRow receipt={item} onDelete={() => remove(item)} />}
      />
    </SafeAreaView>
  )
}

// Swipe a receipt left to delete it.
function ReceiptRow({ receipt, onDelete }: { receipt: ReceiptSummary; onDelete: () => void }) {
  const theme = useTheme()
  const itemCount = receipt.receipts_items[0]?.count ?? 0
  return (
    <SwipeToDelete
      onPress={() => router.push(`/receipts/${receipt.id}`)}
      onDelete={onDelete}
      deleteLabel="Delete receipt">
      {(pressed) => (
        <Card style={[styles.row, { backgroundColor: pressed ? theme.primaryTint : theme.surface }]}>
          <View style={styles.flex}>
            <AppText variant="heading" numberOfLines={1}>
              {receipt.merchant_name || receipt.merchant_name_en || 'Receipt'}
            </AppText>
            <AppText variant="caption">
              {new Date(receipt.created_at).toLocaleDateString()} · {itemCount} item{itemCount === 1 ? '' : 's'} ·{' '}
              {receipt.user_type === 'payer' ? 'You paid' : 'Someone else paid'}
            </AppText>
          </View>
          <AppText variant="heading" style={styles.amount}>
            {formatMoney(receipt.total, receipt.currency)}
          </AppText>
        </Card>
      )}
    </SwipeToDelete>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: {
    padding: Spacing.three,
    gap: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: { gap: Spacing.three, marginBottom: Spacing.one },
  hero: { gap: Spacing.two, padding: Spacing.four - 4 },
  heroButton: { marginTop: Spacing.two },
  account: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  empty: { alignItems: 'center', paddingVertical: Spacing.five },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  amount: { fontVariant: ['tabular-nums'] },
  footer: { marginVertical: Spacing.three },
})
