import { router, Stack, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AppText, Button, Card } from '@/components/ui'
import { MaxContentWidth, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useUserId } from '@/lib/auth'
import { listReceipts, type ReceiptSummary } from '@/lib/receipts'
import { pendingJoin } from '@/lib/share'
import { formatMoney } from '@/lib/split'

const PAGE_SIZE = 20

export default function HomeScreen() {
  const theme = useTheme()
  const userId = useUserId()
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

  // Reload when coming back from a newly saved receipt, and resume a share
  // link that was opened before signing in.
  useFocusEffect(
    useCallback(() => {
      const token = pendingJoin.take()
      if (token) router.push(`/join/${token}`)
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

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/account')} hitSlop={8} accessibilityRole="button">
              <AppText variant="label" style={{ color: theme.primary }}>
                Account
              </AppText>
            </Pressable>
          ),
        }}
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
            <Button title="Scan a receipt" onPress={() => router.push('/scan')} />
            {error && <AppText variant="error">{error}</AppText>}
            {receipts.length > 0 && <AppText variant="heading">Your receipts</AppText>}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator />
          ) : (
            <Card style={styles.empty}>
              <AppText variant="heading">No receipts yet</AppText>
              <AppText variant="muted">Scan a bill to work out who owes what.</AppText>
            </Card>
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} /> : null}
        renderItem={({ item }) => <ReceiptRow receipt={item} shared={item.user_id !== userId} />}
      />
    </SafeAreaView>
  )
}

function ReceiptRow({ receipt, shared }: { receipt: ReceiptSummary; shared: boolean }) {
  const itemCount = receipt.receipts_items[0]?.count ?? 0
  return (
    <Pressable onPress={() => router.push(`/receipts/${receipt.id}`)} accessibilityRole="button">
      {({ pressed }) => (
        <Card style={[styles.row, { opacity: pressed ? 0.7 : 1 }]}>
          <View style={styles.flex}>
            <AppText variant="label" numberOfLines={1}>
              {receipt.merchant_name || receipt.merchant_name_en || 'Receipt'}
            </AppText>
            <AppText variant="muted">
              {new Date(receipt.created_at).toLocaleDateString()} · {itemCount} item{itemCount === 1 ? '' : 's'} ·{' '}
              {shared ? 'Shared with you' : receipt.user_type === 'payer' ? 'You paid' : 'Someone else paid'}
            </AppText>
          </View>
          <AppText variant="label">{formatMoney(receipt.total, receipt.currency)}</AppText>
        </Card>
      )}
    </Pressable>
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
  header: { gap: Spacing.three, marginBottom: Spacing.two },
  empty: { alignItems: 'center', paddingVertical: Spacing.five },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  footer: { marginVertical: Spacing.three },
})
