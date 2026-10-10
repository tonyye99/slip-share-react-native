import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Chip } from '@/components/chip'
import { AppText, Button, Card, Row } from '@/components/ui'
import { MaxContentWidth, Spacing } from '@/constants/theme'
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
import { formatMoney, itemCostPerPerson, splitByPerson } from '@/lib/split'

const MAX_NAME_LENGTH = 40
const LINK_ERROR = "This link doesn't work. It may have been turned off, so ask whoever sent it for a new one."

// Opened from a friend link (https://<site>/pick/<token>), usually on the
// website by someone without the app. They type their name, or tap one the
// owner already added, and tick what they had. No sign-up.
export default function PickScreen() {
  const { token } = useLocalSearchParams<{ token: string }>()
  const theme = useTheme()
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
  const localizedName = (original: string | null, english: string | null) =>
    showEnglish && english ? english : original || english || ''
  const title = localizedName(receipt.merchant_name, receipt.merchant_name_en) || 'Receipt'
  const hasTranslation = !!receipt.merchant_name_en || receipt.items.some((item) => item.name_en)
  const people = receipt.people
  const nameOf = (personId: string) => people.find((person) => person.id === personId)?.name ?? 'Someone'
  const owner = people.find((person) => person.is_owner)
  const payer = people.find((person) => person.is_payer)
  const me = identity ? people.find((person) => person.id === identity.person_id) : undefined
  const split = splitByPerson(
    receipt,
    receipt.items,
    people.map((person) => person.id),
    Object.fromEntries(receipt.items.map((item) => [item.id, item.person_ids])),
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
    const typed = name.trim().replace(/\s+/g, ' ')
    if (!typed) return
    join({ name: typed })
  }

  const toggle = (item: LinkItem) => {
    if (!identity) return
    const had = item.person_ids.includes(identity.person_id)
    const person_ids = had
      ? item.person_ids.filter((id) => id !== identity.person_id)
      : [...item.person_ids, identity.person_id]
    setReceipt((prev) =>
      prev && { ...prev, items: prev.items.map((other) => (other.id === item.id ? { ...other, person_ids } : other)) },
    )
    saves.current = saves.current.then(() =>
      setLinkPick(token, identity, item.id, !had).catch(async (e) => {
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

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: `${title} · SlipShare` }} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View style={styles.header}>
          <AppText variant="title">{title}</AppText>
          <AppText variant="muted">
            Total {money(receipt.total)}
            {owner ? ` · Shared by ${owner.name}` : ''}
            {payer ? ` · Paid by ${payer.id === me?.id ? 'you' : payer.name}` : ''}
          </AppText>
        </View>

        {!me && (
          <Card>
            <AppText variant="heading">Who are you?</AppText>
            <AppText variant="muted">
              {openNames.length > 0 ? 'Tap your name, or type it.' : 'Type your name.'} There&apos;s nothing to install
              and no sign-up.
            </AppText>
            {openNames.length > 0 && (
              <View style={styles.chips}>
                {openNames.map((person) => (
                  <Chip
                    key={person.id}
                    role="button"
                    label={person.name}
                    disabled={joining}
                    onPress={() => join({ personId: person.id })}
                    accessibilityLabel={`I'm ${person.name}`}
                  />
                ))}
              </View>
            )}
            <View style={styles.addRow}>
              <TextInput
                value={name}
                onChangeText={setName}
                onSubmitEditing={joinWithName}
                placeholder="Your name"
                placeholderTextColor={theme.textSecondary}
                maxLength={MAX_NAME_LENGTH}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                editable={!joining}
                accessibilityLabel="Your name"
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              />
              <Button title="Join" onPress={joinWithName} loading={joining} disabled={!name.trim()} />
            </View>
          </Card>
        )}

        {me && (
          <AppText variant="muted">
            You&apos;re {me.name}. Tap what you had. Shared items are split evenly, and your picks save as you tap.
          </AppText>
        )}

        {me && hasTranslation && (
          <Card style={styles.toggle}>
            <AppText variant="label" style={styles.flex}>
              Show English names
            </AppText>
            <Switch value={showEnglish} onValueChange={setShowEnglish} />
          </Card>
        )}

        {me &&
          receipt.items.map((item) => {
            const had = item.person_ids.includes(me.id)
            const others = item.person_ids.filter((id) => id !== me.id).map(nameOf)
            return (
              <Pressable
                key={item.id}
                onPress={() => toggle(item)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: had }}>
                <Card style={[styles.item, { borderColor: had ? theme.primary : 'transparent' }]}>
                  <View style={styles.itemRow}>
                    <View
                      style={[
                        styles.check,
                        { borderColor: had ? theme.primary : theme.textSecondary },
                        had && { backgroundColor: theme.primary },
                      ]}>
                      {had && <AppText style={{ color: theme.onPrimary, lineHeight: 18 }}>✓</AppText>}
                    </View>
                    <View style={styles.flex}>
                      <AppText>{localizedName(item.name, item.name_en)}</AppText>
                      <AppText variant="muted">
                        {item.qty} × {money(item.unit_price)}
                        {others.length > 0 ? ` · Also ${others.join(', ')}` : ''}
                      </AppText>
                    </View>
                    <AppText style={styles.amount}>
                      {money(had ? itemCostPerPerson(item, item.person_ids.length) : item.qty * item.unit_price)}
                    </AppText>
                  </View>
                </Card>
              </Pressable>
            )
          })}
      </ScrollView>

      {me && mine && (
        <View style={[styles.summary, { backgroundColor: theme.background, borderColor: theme.border }]}>
          {mine.subtotal !== 0 && (
            <>
              <Row label="Your items" value={money(mine.subtotal)} />
              {receipt.service_percent > 0 && (
                <Row label={`Service (${receipt.service_percent}%)`} value={money(mine.service)} />
              )}
              {receipt.tax_percent > 0 && <Row label={`Tax (${receipt.tax_percent}%)`} value={money(mine.tax)} />}
              {Math.abs(mine.rounding) > 0.001 && <Row label="Rounding" value={money(mine.rounding)} />}
            </>
          )}
          <Row
            label={payer && payer.id !== me.id ? `You owe ${payer.name}` : 'Your share'}
            value={money(mine.total)}
            bold
          />
          {me.paid && payer && payer.id !== me.id && (
            <AppText variant="muted">✓ {payer.name} marked you as paid.</AppText>
          )}
        </View>
      )}
    </SafeAreaView>
  )
}

function Centered({ children }: { children: ReactNode }) {
  const theme = useTheme()
  return <View style={[styles.centered, { backgroundColor: theme.background }]}>{children}</View>
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  content: { padding: Spacing.three, gap: Spacing.two, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { gap: Spacing.one, marginBottom: Spacing.two },
  toggle: { flexDirection: 'row', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: Spacing.three, minHeight: 48, fontSize: 16 },
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
