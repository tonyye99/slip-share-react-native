import { useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AppText, Button, Card, Row } from '@/components/ui'
import { MaxContentWidth, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { confirmDestructive, showAlert } from '@/lib/alert'
import {
  addItemPeople,
  addPerson,
  getRecentNames,
  getReceipt,
  removeItemPeople,
  removePerson,
  setPayer,
  setPersonPaid,
} from '@/lib/receipts'
import { formatMoney, splitByPerson, totalsMessage, type Assignments } from '@/lib/split'
import type { ReceiptPerson, ReceiptWithPeople } from '@/lib/types'

const MAX_NAME_LENGTH = 40
const MAX_SUGGESTIONS = 6

/** Your own line reads "You" on screen. */
const nameOf = (person: ReceiptPerson) => (person.is_me ? 'You' : person.name)

const assignmentsOf = (receipt: ReceiptWithPeople): Assignments =>
  Object.fromEntries(receipt.receipts_items.map((item) => [item.id, item.receipt_item_people.map((row) => row.person_id)]))

// The person who scanned the bill splits it: they add who was there, tick who
// had each item and send everyone their total. Friends don't need the app.
export default function SplitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const theme = useTheme()
  const [receipt, setReceipt] = useState<ReceiptWithPeople | null>(null)
  const [people, setPeople] = useState<ReceiptPerson[]>([])
  const [assignments, setAssignments] = useState<Assignments>({})
  const [recentNames, setRecentNames] = useState<string[]>([])
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [showEnglish, setShowEnglish] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Changes save as you tap. They reach the database one at a time and in
  // order, so quick taps on the same name can't land out of order.
  const saves = useRef<Promise<void>>(Promise.resolve())

  const show = useCallback((receipt: ReceiptWithPeople) => {
    setReceipt(receipt)
    setPeople(receipt.receipt_people)
    setAssignments(assignmentsOf(receipt))
  }, [])

  useEffect(() => {
    getReceipt(id)
      .then(show)
      .catch((e) => {
        console.error('Load failed', e)
        setError("This receipt doesn't exist or you don't have access to it.")
      })
    getRecentNames()
      .then(setRecentNames)
      .catch((e) => console.error('Could not load recent names', e))
  }, [id, show])

  const split = useMemo(
    () =>
      receipt
        ? splitByPerson(
            receipt,
            receipt.receipts_items,
            people.map((person) => person.id),
            assignments,
          )
        : null,
    [receipt, people, assignments],
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
  const totalOf = (person: ReceiptPerson) => split.people[person.id]?.total ?? 0
  const payer = people.find((person) => person.is_payer) ?? null
  const payerName = payer?.is_me ? 'you' : payer?.name
  const hasTranslation = !!receipt.merchant_name_en || receipt.receipts_items.some((item) => item.name_en)
  const localizedName = (original: string | null, english: string | null) =>
    showEnglish && english ? english : original || english || ''
  const title = localizedName(receipt.merchant_name, receipt.merchant_name_en) || 'Receipt'
  const everyoneIds = people.map((person) => person.id)
  const hasUnassigned = Math.abs(split.unassigned.total) >= 0.005
  const onBill = new Set(people.map((person) => person.name.toLowerCase()))
  const suggestions = recentNames.filter((name) => !onBill.has(name.toLowerCase())).slice(0, MAX_SUGGESTIONS)
  // Everyone except the payer pays the payer back.
  const owesPayer = payer ? people.filter((person) => !person.is_payer) : []
  const owedBack = owesPayer.reduce((sum, person) => sum + totalOf(person), 0)
  const paidBack = owesPayer.filter((person) => person.paid_at).reduce((sum, person) => sum + totalOf(person), 0)

  // Shows a change straight away and saves it in the background. If saving
  // fails, the screen goes back to what is saved.
  const save = (write: () => Promise<void>) => {
    saves.current = saves.current.then(() =>
      write().catch((e) => {
        console.error('Save failed', e)
        showAlert('Could not save that change', 'Check your connection and try again.')
        return getReceipt(receipt.id)
          .then(show)
          .catch((loadError) => console.error('Reload failed', loadError))
      }),
    )
  }

  const setItemPeople = (itemId: string, personIds: string[]) =>
    setAssignments((prev) => ({ ...prev, [itemId]: personIds }))

  const togglePerson = (itemId: string, personId: string) => {
    const had = assignments[itemId] ?? []
    if (had.includes(personId)) {
      setItemPeople(
        itemId,
        had.filter((id) => id !== personId),
      )
      save(() => removeItemPeople(itemId, [personId]))
    } else {
      setItemPeople(itemId, [...had, personId])
      save(() => addItemPeople([{ item_id: itemId, person_id: personId }]))
    }
  }

  const toggleEveryone = (itemId: string) => {
    const had = assignments[itemId] ?? []
    if (everyoneIds.every((personId) => had.includes(personId))) {
      setItemPeople(itemId, [])
      save(() => removeItemPeople(itemId, everyoneIds))
    } else {
      setItemPeople(itemId, everyoneIds)
      save(() => addItemPeople(everyoneIds.map((person_id) => ({ item_id: itemId, person_id }))))
    }
  }

  const splitEvenly = () => {
    const run = () => {
      setAssignments(Object.fromEntries(receipt.receipts_items.map((item) => [item.id, everyoneIds])))
      save(() =>
        addItemPeople(
          receipt.receipts_items.flatMap((item) => everyoneIds.map((person_id) => ({ item_id: item.id, person_id }))),
        ),
      )
    }
    if (!Object.values(assignments).some((had) => had.length > 0)) return run()
    confirmDestructive(
      'Split everything evenly?',
      'Everyone will share every item, including the ones you already ticked.',
      'Split evenly',
      run,
    )
  }

  const add = async (typed: string) => {
    const name = typed.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH)
    if (!name || adding) return
    const key = name.toLowerCase()
    if (key === 'you' || key === 'me') {
      showAlert('Already on this bill', "You're on every bill you scan.")
      return
    }
    if (onBill.has(key)) {
      showAlert('Already on this bill', `${name} is already on this bill.`)
      return
    }
    setAdding(true)
    try {
      const person = await addPerson(receipt.id, name)
      setPeople((prev) => [...prev, person])
      setNewName('')
    } catch (e) {
      console.error('Add person failed', e)
      showAlert(`Could not add ${name}`, 'Check your connection and try again.')
    } finally {
      setAdding(false)
    }
  }

  const confirmRemove = (person: ReceiptPerson) => {
    const remove = () => {
      setPeople((prev) => prev.filter((other) => other.id !== person.id))
      setAssignments((prev) =>
        Object.fromEntries(Object.entries(prev).map(([itemId, had]) => [itemId, had.filter((id) => id !== person.id)])),
      )
      save(() => removePerson(person.id))
    }
    if (!Object.values(assignments).some((had) => had.includes(person.id))) return remove()
    confirmDestructive(
      `Remove ${person.name}?`,
      'Items they shared will be split between the others who had them. Items only they had will be unassigned.',
      'Remove',
      remove,
    )
  }

  const choosePayer = (person: ReceiptPerson) => {
    if (person.is_payer) return
    setPeople((prev) =>
      prev.map((other) => ({
        ...other,
        is_payer: other.id === person.id,
        // The payer has nobody to pay back.
        paid_at: other.id === person.id ? null : other.paid_at,
      })),
    )
    save(() => setPayer(receipt.id, person.id))
  }

  const togglePaid = (person: ReceiptPerson) => {
    const paid = !person.paid_at
    setPeople((prev) =>
      prev.map((other) => (other.id === person.id ? { ...other, paid_at: paid ? new Date().toISOString() : null } : other)),
    )
    save(() => setPersonPaid(person.id, paid))
  }

  const sendTotals = async () => {
    const message = totalsMessage({
      title,
      currency: receipt.currency,
      total: receipt.total,
      service_percent: receipt.service_percent,
      tax_percent: receipt.tax_percent,
      payer: payer ? (payer.is_me ? 'me' : payer.name) : null,
      people: people.map((person) => ({
        name: person.is_me ? 'Me' : person.name,
        total: totalOf(person),
        paid: !!person.paid_at,
      })),
      unassigned: split.unassigned.total,
    })
    try {
      await Share.share({ message })
    } catch (e) {
      // Browsers without a share sheet (most desktops): copy the text instead.
      if (Platform.OS !== 'web') return console.error('Share failed', e)
      try {
        await navigator.clipboard.writeText(message)
        showAlert('Totals copied', 'Paste them into LINE, WhatsApp or wherever you chat.')
      } catch (copyError) {
        console.error('Copy failed', copyError)
        showAlert('Your totals', message)
      }
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets>
        <View style={styles.header}>
          <AppText variant="title">{title}</AppText>
          <AppText variant="muted">
            Total {money(receipt.total)}
            {payer && people.length > 1 ? ` · Paid by ${payerName}` : ''}
          </AppText>
        </View>

        <Card>
          <AppText variant="heading">Who&apos;s splitting</AppText>
          {people.length === 1 && (
            <AppText variant="muted">Add the people you ate with, then tap who had each item.</AppText>
          )}
          {people.map((person) => (
            <View key={person.id} style={styles.personRow}>
              <View style={styles.flex}>
                <AppText>{nameOf(person)}</AppText>
                {person.is_payer && people.length > 1 && <AppText variant="muted">Paid the bill</AppText>}
              </View>
              <AppText style={styles.amount}>{money(totalOf(person))}</AppText>
              {payer && !person.is_payer && (
                <Chip
                  label={person.paid_at ? '✓ Paid' : 'Mark paid'}
                  selected={!!person.paid_at}
                  onPress={() => togglePaid(person)}
                  accessibilityLabel={`${nameOf(person)} paid ${payerName} back`}
                />
              )}
              {!person.is_me && (
                <Pressable
                  onPress={() => confirmRemove(person)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${person.name}`}>
                  <AppText variant="muted">✕</AppText>
                </Pressable>
              )}
            </View>
          ))}
          {owesPayer.length > 0 && (
            <Row label={`Paid back to ${payerName}`} value={`${money(paidBack)} of ${money(owedBack)}`} />
          )}
          <View style={styles.addRow}>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              onSubmitEditing={() => add(newName)}
              placeholder="Add a name"
              placeholderTextColor={theme.textSecondary}
              maxLength={MAX_NAME_LENGTH}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              submitBehavior="submit"
              editable={!adding}
              accessibilityLabel="Name of someone to add"
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            />
            <Button title="Add" variant="secondary" onPress={() => add(newName)} loading={adding} disabled={!newName.trim()} />
          </View>
          {suggestions.length > 0 && (
            <View style={styles.chips}>
              {suggestions.map((name) => (
                <Chip key={name} label={`+ ${name}`} onPress={() => add(name)} accessibilityLabel={`Add ${name}`} />
              ))}
            </View>
          )}
        </Card>

        {people.length > 1 && (
          <Card>
            <AppText variant="heading">Who paid?</AppText>
            <View style={styles.chips}>
              {people.map((person) => (
                <Chip
                  key={person.id}
                  role="radio"
                  label={nameOf(person)}
                  selected={person.is_payer}
                  onPress={() => choosePayer(person)}
                />
              ))}
            </View>
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

        <AppText variant="muted">Tap who had each item. Shared items are split evenly.</AppText>
        {people.length > 1 && <Button title="Split everything evenly" variant="secondary" onPress={splitEvenly} />}

        {receipt.receipts_items.map((item) => {
          const had = assignments[item.id] ?? []
          const lineTotal = item.qty * item.unit_price
          return (
            <Card key={item.id}>
              <View style={styles.itemRow}>
                <View style={styles.flex}>
                  <AppText>{localizedName(item.name, item.name_en)}</AppText>
                  <AppText variant="muted">
                    {item.qty} × {money(item.unit_price)}
                    {had.length > 1 ? ` · ${money(lineTotal / had.length)} each` : ''}
                  </AppText>
                </View>
                <AppText style={styles.amount}>{money(lineTotal)}</AppText>
              </View>
              <View style={styles.chips}>
                {people.map((person) => (
                  <Chip
                    key={person.id}
                    label={nameOf(person)}
                    selected={had.includes(person.id)}
                    onPress={() => togglePerson(item.id, person.id)}
                  />
                ))}
                {people.length > 2 && (
                  <Chip
                    label="Everyone"
                    selected={everyoneIds.every((personId) => had.includes(personId))}
                    onPress={() => toggleEveryone(item.id)}
                  />
                )}
              </View>
            </Card>
          )
        })}
      </ScrollView>

      <View style={[styles.summary, { backgroundColor: theme.background, borderColor: theme.border }]}>
        {hasUnassigned ? (
          <Row label="Not assigned yet" value={money(split.unassigned.total)} bold />
        ) : (
          <AppText variant="muted">Every item is assigned.</AppText>
        )}
        <Button title="Send totals" onPress={sendTotals} />
      </View>
    </SafeAreaView>
  )
}

function Chip({
  label,
  selected = false,
  onPress,
  role = 'checkbox',
  accessibilityLabel,
}: {
  label: string
  selected?: boolean
  onPress: () => void
  role?: 'checkbox' | 'radio'
  accessibilityLabel?: string
}) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={role === 'radio' ? { selected } : { checked: selected }}
      style={[styles.chip, { borderColor: theme.primary, backgroundColor: selected ? theme.primary : 'transparent' }]}>
      <AppText variant="label" style={{ color: selected ? theme.onPrimary : theme.primary }}>
        {label}
      </AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  content: { padding: Spacing.three, gap: Spacing.two, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { gap: Spacing.one, marginBottom: Spacing.two },
  toggle: { flexDirection: 'row', alignItems: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  amount: { fontVariant: ['tabular-nums'] },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 36 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: Spacing.three, minHeight: 48, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    minHeight: 32,
    justifyContent: 'center',
  },
  summary: {
    padding: Spacing.three,
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
})
