import { router, useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Chip, usePersonColor } from '@/components/chip'
import { AccountButton } from '@/components/home/account-button'
import { MonthCard, ToSplitCard, WaitingCard } from '@/components/home/bill-cards'
import { BillRow } from '@/components/home/bill-row'
import { FirstTime } from '@/components/home/first-time'
import { ScanFooter } from '@/components/home/scan-footer'
import { ScreenHeader } from '@/components/screen-header'
import { AppText } from '@/components/ui'
import { MaxContentWidth, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { dateLocale, useT, type Strings } from '@/i18n'
import { showAlert } from '@/lib/alert'
import { useAuth } from '@/lib/auth'
import {
  badgeText,
  billName,
  billStatus,
  biggestDebt,
  monthTotal,
  reminderText,
  type Bill,
  type BillState,
} from '@/lib/bills'
import { pickedPhoto, pickPhoto } from '@/lib/photo'
import { confirmDeleteReceipt, deleteReceipt, listBills } from '@/lib/receipts'
import { shareText } from '@/lib/share-text'
import { formatMoney } from '@/lib/split'

const PAGE_SIZE = 30

type Filter = 'all' | BillState
const FILTERS: { key: Filter; label: (t: Strings['home']) => string }[] = [
  { key: 'all', label: (t) => t.all },
  { key: 'to-split', label: (t) => t.toSplit },
  { key: 'waiting', label: (t) => t.waiting },
  { key: 'settled', label: (t) => t.settled },
]

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** "Wed, Oct 15", with the year when it isn't this year. */
const dateLabel = (date: Date, now: Date) =>
  date.toLocaleDateString(dateLocale(), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })

/** "Today", "Yesterday" or the date. */
function dayLabel(date: Date, now: Date, t: Strings['home']) {
  if (sameDay(date, now)) return t.today
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  return sameDay(date, yesterday) ? t.yesterday : dateLabel(date, now)
}

export default function HomeScreen() {
  const theme = useTheme()
  const t = useT()
  const insets = useSafeAreaInsets()
  const personColor = usePersonColor()
  const { session } = useAuth()
  const [bills, setBills] = useState<Bill[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')

  const loadFailed = t.home.loadFailed
  const loadFirstPage = useCallback(async () => {
    try {
      const page = await listBills(0, PAGE_SIZE)
      setBills(page.bills)
      setTotal(page.total)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : loadFailed)
    } finally {
      setLoading(false)
    }
  }, [loadFailed])

  // Reload when coming back from a bill, which may have changed.
  useFocusEffect(
    useCallback(() => {
      loadFirstPage()
    }, [loadFirstPage]),
  )

  const loadMore = async () => {
    if (loadingMore || bills.length >= total) return
    setLoadingMore(true)
    try {
      const page = await listBills(bills.length, PAGE_SIZE)
      setBills((prev) => [...prev, ...page.bills])
      setTotal(page.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : t.home.loadFailed)
    } finally {
      setLoadingMore(false)
    }
  }

  const remove = (bill: Bill) =>
    confirmDeleteReceipt(async () => {
      try {
        await deleteReceipt(bill.id)
        setBills((prev) => prev.filter((other) => other.id !== bill.id))
        setTotal((prev) => prev - 1)
      } catch (e) {
        console.error('Delete receipt failed', e)
        showAlert(t.home.deleteFailed, t.common.checkConnection)
      }
    })

  // Take a photo (or pick one) here, then check it on the scan screen.
  const scan = async (source: 'camera' | 'library') => {
    const photo = await pickPhoto(source)
    if (!photo) return
    pickedPhoto.set(photo)
    router.push('/scan')
  }

  const openBill = (id: string) => router.push(`/receipts/${id}`)

  const withStatus = useMemo(() => bills.map((bill) => ({ bill, status: billStatus(bill) })), [bills])
  const now = new Date()
  const top = biggestDebt(withStatus)
  const toSplit = withStatus.filter(({ status }) => status.state === 'to-split')
  const month = monthTotal(bills, now)
  const shown = filter === 'all' ? withStatus : withStatus.filter(({ status }) => status.state === filter)

  const remind = () => {
    if (!top) return
    const money = (amount: number) => formatMoney(amount, top.bill.currency)
    shareText(reminderText(top.debt, billName(top.bill), dateLabel(new Date(top.bill.created_at), now), money))
  }

  const header = (
    <ScreenHeader
      brand
      plain
      back={false}
      right={<AccountButton user={session?.user} />}
    />
  )

  if (loading || (error && bills.length === 0)) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.background }]}>
        {header}
        <View style={styles.centered}>{error ? <AppText variant="error">{error}</AppText> : <ActivityIndicator />}</View>
      </View>
    )
  }

  if (bills.length === 0) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.background }]}>
        {header}
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}
          refreshControl={<RefreshControl refreshing={false} onRefresh={loadFirstPage} />}>
          <FirstTime />
        </ScrollView>
        <ScanFooter title={t.home.scanFirst} onCamera={() => scan('camera')} onLibrary={() => scan('library')} />
      </View>
    )
  }

  const monthMoney = (amount: number) => formatMoney(amount, month.currency)
  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      {header}
      <FlatList
        data={shown}
        keyExtractor={({ bill }) => bill.id}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}
        refreshControl={<RefreshControl refreshing={false} onRefresh={loadFirstPage} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={styles.top}>
            {top && (
              <WaitingCard
                amount={formatMoney(top.debt.amount, top.bill.currency)}
                name={top.debt.name}
                color={personColor(top.debt.index)}
                billName={billName(top.bill)}
                onOpen={() => openBill(top.bill.id)}
                onRemind={remind}
              />
            )}
            <View style={styles.pair}>
              <MonthCard
                month={now.toLocaleDateString(dateLocale(), { month: 'long' })}
                amount={monthMoney(month.total)}
                count={t.common.bills(month.count)}
              />
              {toSplit.length > 0 && (
                <ToSplitCard
                  count={t.common.bills(toSplit.length)}
                  onPress={() => (toSplit.length === 1 ? openBill(toSplit[0].bill.id) : setFilter('to-split'))}
                />
              )}
            </View>
            {error && <AppText variant="error">{error}</AppText>}
            <View style={styles.bills}>
              <AppText variant="title" style={styles.heading} accessibilityRole="header">
                {t.home.yourBills}
              </AppText>
              {/* One line that scrolls sideways when the words don't fit, as in Thai on a small phone. */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterRow}
                contentContainerStyle={styles.filters}
                accessibilityRole="radiogroup">
                {FILTERS.map(({ key, label }) => (
                  <Chip key={key} label={label(t.home)} role="radio" selected={filter === key} onPress={() => setFilter(key)} />
                ))}
              </ScrollView>
            </View>
          </View>
        }
        ListEmptyComponent={
          <AppText variant="muted" style={styles.none}>
            {t.home.noneHere}
          </AppText>
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.more} /> : undefined}
        renderItem={({ item: { bill, status }, index }) => {
          const money = (amount: number) => formatMoney(amount, bill.currency)
          return (
            <BillRow
              name={billName(bill)}
              caption={`${dayLabel(new Date(bill.created_at), now, t.home)} · ${t.common.items(status.itemCount)}`}
              amount={money(bill.total)}
              state={status.state}
              badge={badgeText(status, money)}
              first={index === 0}
              last={index === shown.length - 1}
              onOpen={() => openBill(bill.id)}
              onDelete={() => remove(bill)}
            />
          )
        }}
      />
      <ScanFooter title={t.home.scanReceipt} onCamera={() => scan('camera')} onLibrary={() => scan('library')} />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one + 3,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  top: { gap: Spacing.three - 4, marginBottom: Spacing.three - 4 },
  pair: { flexDirection: 'row', gap: Spacing.three - 5 },
  bills: { gap: Spacing.two + 2, marginTop: 3 },
  heading: { fontSize: 20, lineHeight: 26, marginLeft: 3 },
  // Runs to the screen edges, so a chip that doesn't fit shows it scrolls.
  filterRow: { flexGrow: 0, marginHorizontal: -Spacing.three },
  filters: { gap: Spacing.two, paddingHorizontal: Spacing.three },
  none: { textAlign: 'center', paddingVertical: Spacing.four },
  more: { marginVertical: Spacing.three },
})
