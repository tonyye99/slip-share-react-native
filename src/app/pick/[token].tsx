import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Avatar, usePersonColor } from '@/components/chip'
import { CheckBoxIcon, ClockIcon } from '@/components/icons'
import { ScreenHeader } from '@/components/screen-header'
import { AppText, Button, Card, Divider, Input, Row, Segmented, Stepper } from '@/components/ui'
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { showAlert } from '@/lib/alert'
import {
  forgetIdentity,
  getLinkReceipt,
  isIdentityRejected,
  isLinkToken,
  joinErrorMessage,
  joinLink,
  loadIdentity,
  setLinkPick,
  type LinkIdentity,
  type LinkItem,
  type LinkReceipt,
} from '@/lib/link-picks'
import { bothNames, cleanName, MAX_NAME_LENGTH, originalLabel } from '@/lib/names'
import { formatMoney, isCountable, itemShares, splitByPicks } from '@/lib/split'

const LINK_ERROR = "This link doesn't work. It may have been turned off, so ask whoever sent it for a new one."

// Opened from a friend link (https://<site>/pick/<token>), usually on the
// website by someone without the app. They type their name, or tap one the
// owner already added, and tick what they had. No sign-up.
export default function PickScreen() {
  const { token } = useLocalSearchParams<{ token: string }>()
  const theme = useTheme()
  const personColor = usePersonColor()
  const validToken = isLinkToken(token)
  const [receipt, setReceipt] = useState<LinkReceipt | null>(null)
  const [identity, setIdentity] = useState<LinkIdentity | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [joining, setJoining] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showEnglish, setShowEnglish] = useState(false)
  // Ticks save as you tap, one at a time and in order.
  const saves = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    if (!isLinkToken(token)) return
    Promise.all([getLinkReceipt(token), loadIdentity(token)])
      .then(([receipt, saved]) => {
        setReceipt(receipt)
        // A name the owner has since removed no longer counts.
        setIdentity(saved && receipt.people.some((person) => person.id === saved.person_id) ? saved : null)
      })
      .catch((e) => {
        console.error('Link load failed', e)
        setError(LINK_ERROR)
      })
  }, [token])

  if (!validToken || error) {
    return (
      <Centered>
        <AppText variant="error">{LINK_ERROR}</AppText>
      </Centered>
    )
  }
  if (!receipt) {
    return (
      <Centered>
        <ActivityIndicator />
      </Centered>
    )
  }

  const money = (amount: number) => formatMoney(amount, receipt.currency)
  const title = bothNames(receipt.merchant_name, receipt.merchant_name_en, showEnglish).main || 'Receipt'
  const originalLanguage = originalLabel([receipt.merchant_name, ...receipt.items.map((item) => item.name)])
  const hasTranslation = !!receipt.merchant_name_en || receipt.items.some((item) => item.name_en)
  const people = receipt.people
  const nameOf = (personId: string) => people.find((person) => person.id === personId)?.name ?? 'Someone'
  const owner = people.find((person) => person.is_owner)
  const payer = people.find((person) => person.is_payer)
  const me = identity ? people.find((person) => person.id === identity.person_id) : undefined
  const split = splitByPicks(
    receipt,
    receipt.items,
    people.map((person) => person.id),
    Object.fromEntries(receipt.items.map((item) => [item.id, item.counts])),
  )
  const mine = me ? split.people[me.id] : undefined
  const openNames = people.filter((person) => !person.is_owner && !person.claimed)

  const reload = () =>
    getLinkReceipt(token)
      .then(setReceipt)
      .catch((e) => {
        console.error('Link reload failed', e)
        setError(LINK_ERROR)
      })

  const refresh = async () => {
    setRefreshing(true)
    await saves.current
    await reload()
    setRefreshing(false)
  }

  const join = async (choice: { personId: string } | { name: string }) => {
    setJoining(true)
    try {
      setIdentity(await joinLink(token, choice))
      setName('')
    } catch (e) {
      console.error('Join failed', e)
      showAlert('Could not add you', joinErrorMessage(e))
    } finally {
      setJoining(false)
    }
    await reload()
  }

  const joinWithName = () => {
    const typed = cleanName(name)
    if (!typed) return
    join({ name: typed })
  }

  // Ticks an item with how many you had, or unticks it (units null).
  const pick = (item: LinkItem, units: number | null) => {
    if (!identity) return
    const others = item.person_ids.filter((id) => id !== identity.person_id)
    const person_ids = units === null ? others : [...others, identity.person_id]
    const counts = Object.fromEntries(
      Object.entries(item.counts).filter(([id]) => id !== identity.person_id),
    )
    if (units !== null) counts[identity.person_id] = units
    setReceipt((prev) =>
      prev && {
        ...prev,
        items: prev.items.map((other) => (other.id === item.id ? { ...other, person_ids, counts } : other)),
      },
    )
    saves.current = saves.current.then(() =>
      setLinkPick(token, identity, item.id, units !== null, units ?? 1).catch(async (e) => {
        console.error('Pick failed', e)
        if (isIdentityRejected(e)) {
          await forgetIdentity(token)
          setIdentity(null)
          showAlert('Pick your name again', 'The person who shared this bill may have removed you from it.')
        } else {
          showAlert('Could not save that', 'Check your connection and try again.')
        }
        await reload()
      }),
    )
  }

  // A new tick is for one of the line; − 1 + changes it on lines like 2 × Egg Kim Bab.
  const toggle = (item: LinkItem) => {
    if (identity) pick(item, item.person_ids.includes(identity.person_id) ? null : 1)
  }

  const notMe = async () => {
    await saves.current
    await forgetIdentity(token)
    setIdentity(null)
  }

  const colorOf = (personId: string) => personColor(people.findIndex((person) => person.id === personId))
  const ownerName = owner?.name ?? 'The payer'
  const payerName = payer ? (payer.id === me?.id ? 'you' : payer.name) : null
  const mineCount = me ? receipt.items.filter((item) => item.person_ids.includes(me.id)).length : 0
  const owes = !!payer && !!me && payer.id !== me.id

  const languageSwitch = (
    <Segmented
      accessibilityLabel="Item names"
      options={[
        { value: 'original', label: originalLanguage },
        { value: 'en', label: 'EN' },
      ]}
      value={showEnglish ? 'en' : 'original'}
      onChange={(value) => setShowEnglish(value === 'en')}
    />
  )

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: `${title} · SlipShare` }} />
      <ScreenHeader
        brand
        back={false}
        right={
          me ? (
            <View style={styles.me}>
              <Avatar name={me.name} color={colorOf(me.id)} size={28} />
              <AppText variant="label" numberOfLines={1} style={styles.meName}>
                {me.name}
              </AppText>
              <Pressable onPress={notMe} hitSlop={8} accessibilityRole="button">
                <AppText variant="caption" style={{ color: theme.primary, textDecorationLine: 'underline' }}>
                  Not you?
                </AppText>
              </Pressable>
            </View>
          ) : hasTranslation ? (
            languageSwitch
          ) : null
        }
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {!me ? (
          <>
            <View style={styles.header}>
              <AppText variant="title">{title}</AppText>
              <AppText variant="muted">
                Total {money(receipt.total)}
                {owner ? ` · Shared by ${owner.name}` : ''}
                {payer ? ` · Paid by ${payer.name}` : ''}
              </AppText>
            </View>

            <Card style={styles.stepCard}>
              <AppText variant="overline">Step 1 of 2</AppText>
              <AppText variant="title">Who are you?</AppText>
              <AppText variant="muted">
                {openNames.length > 0 ? `${ownerName} already added these names. Tap yours.` : 'Type your name to join.'}
              </AppText>
              {openNames.length > 0 && (
                <>
                  <View style={styles.nameGrid}>
                    {openNames.map((person) => (
                      <Pressable
                        key={person.id}
                        disabled={joining}
                        onPress={() => join({ personId: person.id })}
                        accessibilityRole="button"
                        accessibilityLabel={`I'm ${person.name}`}
                        style={({ pressed }) => [
                          styles.nameCard,
                          {
                            borderColor: theme.border,
                            backgroundColor: pressed ? theme.primaryTint : theme.surface,
                            opacity: joining ? 0.5 : 1,
                          },
                        ]}>
                        <Avatar name={person.name} color={colorOf(person.id)} size={36} />
                        <AppText variant="heading" numberOfLines={1} style={styles.flex}>
                          {person.name}
                        </AppText>
                      </Pressable>
                    ))}
                  </View>
                  <Divider label="Not on the list?" />
                </>
              )}
              <View style={styles.addRow}>
                <Input
                  value={name}
                  onChangeText={setName}
                  onSubmitEditing={joinWithName}
                  placeholder="Your name"
                  maxLength={MAX_NAME_LENGTH}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                  editable={!joining}
                  accessibilityLabel="Your name"
                  style={styles.flex}
                />
                <Button title="Join" onPress={joinWithName} loading={joining} disabled={!name.trim()} />
              </View>
            </Card>

            <Card dashed>
              <AppText variant="heading">Step 2 · Tick what you had</AppText>
              <View style={styles.point}>
                <CheckBoxIcon color={theme.textSecondary} />
                <AppText variant="caption" style={styles.flex}>
                  Shared dishes split evenly with whoever else ticks them
                </AppText>
              </View>
              <View style={styles.point}>
                <ClockIcon color={theme.textSecondary} />
                <AppText variant="caption" style={styles.flex}>
                  Saves as you tap. {ownerName} sees it right away
                </AppText>
              </View>
            </Card>

            <AppText variant="caption" style={styles.center}>
              No app or sign-up needed.
            </AppText>
          </>
        ) : (
          <>
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <AppText variant="caption" style={styles.flex}>
                  {title} · {money(receipt.total)}
                  {payer ? ` · Paid by ${payerName}` : ''}
                </AppText>
                {hasTranslation && languageSwitch}
              </View>
              <AppText variant="title">What did you have?</AppText>
              <AppText variant="muted">Tick everything you ate or drank. Shared dishes split evenly.</AppText>
            </View>

            <Card style={styles.list}>
              {receipt.items.map((item, index) => {
                const had = item.person_ids.includes(me.id)
                const countable = isCountable(item)
                const units = item.counts[me.id] ?? 1
                const { shares } = itemShares(item, item.person_ids, item.counts)
                const counted = item.person_ids.reduce((sum, id) => sum + (item.counts[id] ?? 1), 0)
                const others = item.person_ids
                  .filter((id) => id !== me.id)
                  .map((id) => (countable ? `${nameOf(id)} (${item.counts[id] ?? 1})` : nameOf(id)))
                const names = bothNames(item.name, item.name_en, showEnglish)
                // On a counted line: "1 of 2", or "all yours". Lines people share say "your share".
                const caption =
                  countable && counted <= item.qty
                    ? units === item.qty
                      ? 'all yours'
                      : `${units} of ${item.qty}`
                    : others.length > 0
                      ? 'your share'
                      : 'all yours'
                return (
                  <View
                    key={item.id}
                    style={[
                      { backgroundColor: had ? theme.primaryTint : theme.surface },
                      index > 0 && { borderTopColor: theme.hairline, borderTopWidth: StyleSheet.hairlineWidth },
                    ]}>
                    <Pressable
                      onPress={() => toggle(item)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: had }}
                      style={styles.pickRow}>
                      <View
                        style={[
                          styles.check,
                          had ? { backgroundColor: theme.primary, borderColor: theme.primary } : { borderColor: theme.border },
                        ]}>
                        {had && <AppText style={[styles.checkMark, { color: theme.onPrimary }]}>✓</AppText>}
                      </View>
                      <View style={styles.flex}>
                        <AppText variant="heading">{names.main}</AppText>
                        <AppText variant="caption">
                          {names.other ? `${names.other} · ` : ''}
                          {item.qty} × {money(item.unit_price)}
                        </AppText>
                        {others.length > 0 && <AppText variant="caption">Also {others.join(', ')}</AppText>}
                      </View>
                      <View style={styles.priceColumn}>
                        <AppText variant="heading" style={[styles.amount, !had && { color: theme.textSecondary, fontWeight: '400' }]}>
                          {money(had ? (shares[me.id] ?? 0) : item.qty * item.unit_price)}
                        </AppText>
                        {had && <AppText variant="caption">{caption}</AppText>}
                      </View>
                    </Pressable>
                    {had && countable && (
                      <View style={styles.countRow}>
                        <AppText variant="label" style={styles.flex}>
                          How many did you have?
                        </AppText>
                        <Stepper value={units} max={item.qty} onChange={(next) => pick(item, next)} label={names.main} />
                      </View>
                    )}
                  </View>
                )
              })}
            </Card>
          </>
        )}
      </ScrollView>

      {me && mine && (
        <SafeAreaView edges={['bottom']} style={[styles.footerBar, { backgroundColor: theme.surface, borderColor: theme.hairline }]}>
          <View style={styles.footer}>
            {mine.subtotal !== 0 && (
              <>
                <Row label={`Your items (${mineCount})`} value={money(mine.subtotal)} />
                {receipt.service_percent > 0 && (
                  <Row label={`Service ${receipt.service_percent}%`} value={money(mine.service)} />
                )}
                {receipt.tax_percent > 0 && <Row label={`VAT ${receipt.tax_percent}%`} value={money(mine.tax)} />}
                {Math.abs(mine.rounding) > 0.001 && <Row label="Rounding" value={money(mine.rounding)} />}
                <Divider />
              </>
            )}
            <View style={styles.oweRow}>
              <AppText variant="heading" style={styles.flex}>
                {owes ? `You owe ${payer.name}` : 'Your share'}
              </AppText>
              <AppText variant="display">{money(mine.total)}</AppText>
            </View>
            <AppText variant="caption" style={{ color: theme.success, fontWeight: '600' }}>
              {me.paid && owes ? `✓ ${payer.name} marked you as paid.` : `✓ Saved. ${ownerName} can see your picks.`}
            </AppText>
          </View>
        </SafeAreaView>
      )}
    </View>
  )

}

function Centered({ children }: { children: ReactNode }) {
  const theme = useTheme()
  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <ScreenHeader brand back={false} />
      <View style={styles.centered}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  content: { padding: Spacing.three, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { gap: Spacing.one },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  center: { textAlign: 'center' },
  me: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexShrink: 1 },
  meName: { maxWidth: 120 },
  stepCard: { gap: Spacing.three - 4 },
  nameGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  nameCard: {
    flexGrow: 1,
    flexBasis: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three - 4,
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  point: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  list: { padding: 0, gap: 0, overflow: 'hidden' },
  pickRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three - 4, padding: Spacing.three },
  // Lines up with the item name, past the tick box.
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.three + 24 + Spacing.three - 4,
    paddingRight: Spacing.three,
    paddingBottom: Spacing.three,
    marginTop: -Spacing.two,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkMark: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  priceColumn: { alignItems: 'flex-end' },
  amount: { fontVariant: ['tabular-nums'] },
  footerBar: { borderTopWidth: StyleSheet.hairlineWidth },
  footer: { padding: Spacing.three, gap: Spacing.one + 2, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  oweRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
})
