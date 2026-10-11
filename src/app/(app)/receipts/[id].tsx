import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Avatar, Chip, PersonChip, personColor } from '@/components/chip'
import { LinkIcon, ShareIcon } from '@/components/icons'
import { ScreenHeader } from '@/components/screen-header'
import { AppText, Button, Card, Divider, Input, ProgressBar, Segmented, Tabs, Tag, TextLink } from '@/components/ui'
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { confirmDestructive, showAlert } from '@/lib/alert'
import { friendLinksAvailable, friendLinkUrl } from '@/lib/link-picks'
import { bothNames, originalLabel } from '@/lib/names'
import {
  addItemPeople,
  addPerson,
  deleteReceipt,
  getRecentNames,
  getReceipt,
  removeItemPeople,
  removePerson,
  setPayer,
  setPersonPaid,
  setReceiptLink,
} from '@/lib/receipts'
import { shareText } from '@/lib/share-text'
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
  const [linkBusy, setLinkBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<'items' | 'payments'>('items')
  // Once people are added, the "Who was there?" card folds away until "+ People" opens it.
  const [editingPeople, setEditingPeople] = useState(false)
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

  if (error || !receipt || !split) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.background }]}>
        <ScreenHeader title="Split bill" />
        <View style={styles.centered}>{error ? <AppText variant="error">{error}</AppText> : <ActivityIndicator />}</View>
      </View>
    )
  }

  const money = (amount: number) => formatMoney(amount, receipt.currency)
  const totalOf = (person: ReceiptPerson) => split.people[person.id]?.total ?? 0
  const payer = people.find((person) => person.is_payer) ?? null
  const payerName = payer?.is_me ? 'you' : payer?.name
  const hasTranslation = !!receipt.merchant_name_en || receipt.receipts_items.some((item) => item.name_en)
  const originalLanguage = originalLabel([receipt.merchant_name, ...receipt.receipts_items.map((item) => item.name)])
  const title = bothNames(receipt.merchant_name, receipt.merchant_name_en, showEnglish).main || 'Receipt'
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

  const sendTotals = () =>
    shareText(
      totalsMessage({
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
      }),
    )

  // Friends who open the link pick their own items; pull down to see them.
  const refresh = async () => {
    setRefreshing(true)
    try {
      await saves.current
      show(await getReceipt(receipt.id))
    } catch (e) {
      console.error('Refresh failed', e)
    } finally {
      setRefreshing(false)
    }
  }

  const shareLink = async () => {
    let token = receipt.share_token
    if (!receipt.link_enabled) {
      setLinkBusy(true)
      try {
        token = await setReceiptLink(receipt.id, true)
        setReceipt({ ...receipt, link_enabled: true, share_token: token })
      } catch (e) {
        console.error('Link on failed', e)
        showAlert('Could not make a link', 'Check your connection and try again.')
        return
      } finally {
        setLinkBusy(false)
      }
    }
    await shareText(`Tick what you had at ${title}, and SlipShare works out your share: ${friendLinkUrl(token)}`)
  }

  const turnOffLink = () =>
    confirmDestructive(
      'Turn off the link?',
      'It stops working for everyone you sent it to. Their picks stay. Sharing again makes a new link.',
      'Turn off',
      async () => {
        setLinkBusy(true)
        try {
          await setReceiptLink(receipt.id, false)
          setReceipt({ ...receipt, link_enabled: false })
        } catch (e) {
          console.error('Link off failed', e)
          showAlert('Could not turn off the link', 'Check your connection and try again.')
        } finally {
          setLinkBusy(false)
        }
      },
    )

  const confirmDelete = () =>
    confirmDestructive(
      'Delete this receipt?',
      "It's removed for good, with the names, picks and payments on it, and its friend link stops working.",
      'Delete',
      async () => {
        setDeleting(true)
        try {
          // Let changes still saving finish first.
          await saves.current
          await deleteReceipt(receipt.id)
          if (router.canGoBack()) router.back()
          else router.replace('/')
        } catch (e) {
          console.error('Delete receipt failed', e)
          setDeleting(false)
          showAlert('Could not delete this receipt', 'Check your connection and try again.')
        }
      },
    )

  const colorOf = (person: ReceiptPerson) => personColor(people.indexOf(person))
  const personById = (personId: string) => people.find((person) => person.id === personId)
  const unassignedCount = receipt.receipts_items.filter((item) => (assignments[item.id] ?? []).length === 0).length
  const assignedTotal = people.reduce((sum, person) => sum + totalOf(person), 0)
  const assignedShare = assignedTotal / (assignedTotal + split.unassigned.total || 1)
  const charges = [
    receipt.service_percent > 0 ? `${receipt.service_percent}% service` : null,
    receipt.tax_percent > 0 ? `${receipt.tax_percent}% VAT` : null,
  ].filter(Boolean)
  const alone = people.length === 1
  const showPeopleStep = alone || editingPeople

  // What an item's price line says about who had it.
  const itemStatus = (had: string[], lineTotal: number) => {
    if (had.length === 0) return { text: 'Not assigned', warn: true }
    if (had.length > 1) return { text: `${money(lineTotal / had.length)} each`, warn: false }
    const only = personById(had[0])
    return { text: !only || only.is_me ? 'All yours' : `All ${only.name}'s`, warn: false }
  }

  const shareLinkTile = (
    <Pressable
      onPress={shareLink}
      disabled={linkBusy}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.linkTile,
        { backgroundColor: theme.primaryTint, borderColor: theme.primarySoft, opacity: linkBusy ? 0.5 : pressed ? 0.8 : 1 },
      ]}>
      <View style={[styles.linkIcon, { backgroundColor: theme.primary }]}>
        {linkBusy ? <ActivityIndicator color={theme.onPrimary} /> : <LinkIcon color={theme.onPrimary} />}
      </View>
      <View style={styles.flex}>
        <AppText variant="label">Share a link</AppText>
        <AppText variant="caption">Friends tick their own items. No app or sign-up.</AppText>
      </View>
    </Pressable>
  )

  const peopleStep = (
    <Card style={styles.stepCard}>
      <View style={styles.stepHeader}>
        <View style={styles.flex}>
          {alone && <AppText variant="overline">Step 1 of 2</AppText>}
          <AppText variant="title">Who was there?</AppText>
        </View>
        {!alone && <Button title="Done" size="small" variant="secondary" onPress={() => setEditingPeople(false)} />}
      </View>
      <AppText variant="muted">
        {alone
          ? "Add everyone sharing this bill. Next, you'll tap who had each item."
          : 'Add or remove people. Items only a removed person had become unassigned.'}
      </AppText>
      <View style={styles.chips}>
        {people.map((person) => (
          <View
            key={person.id}
            style={[styles.personPill, { backgroundColor: person.is_me ? theme.primarySoft : theme.backgroundElement }]}>
            <Avatar name={nameOf(person)} color={colorOf(person)} size={26} />
            <AppText variant="label">{nameOf(person)}</AppText>
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
      </View>
      <View style={styles.addRow}>
        <Input
          value={newName}
          onChangeText={setNewName}
          onSubmitEditing={() => add(newName)}
          placeholder="Friend's name"
          maxLength={MAX_NAME_LENGTH}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          submitBehavior="submit"
          editable={!adding}
          accessibilityLabel="Name of someone to add"
          style={styles.flex}
        />
        <Button title="Add" onPress={() => add(newName)} loading={adding} disabled={!newName.trim()} />
      </View>
      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          <AppText variant="caption">From recent bills</AppText>
          <View style={styles.chips}>
            {suggestions.map((name) => (
              <Chip key={name} role="button" label={`+  ${name}`} onPress={() => add(name)} accessibilityLabel={`Add ${name}`} />
            ))}
          </View>
        </View>
      )}
      {friendLinksAvailable && !receipt.link_enabled && (
        <>
          <Divider label="or let them add themselves" />
          {shareLinkTile}
        </>
      )}
    </Card>
  )

  const itemsTab = (
    <>
      {showPeopleStep && peopleStep}

      {alone ? (
        <View style={styles.sectionRow}>
          <AppText variant="heading" style={styles.flex}>
            Step 2 · Who had what
          </AppText>
          <AppText variant="caption">
            {receipt.receipts_items.length} item{receipt.receipts_items.length === 1 ? '' : 's'}
          </AppText>
        </View>
      ) : (
        <View style={styles.sectionRow}>
          <View style={styles.flex}>
            <AppText variant="title">Who had what?</AppText>
            <AppText variant="muted">Tap names on each item. Shared items split evenly.</AppText>
          </View>
          <Button title="Split all evenly" size="small" variant="secondary" onPress={splitEvenly} />
        </View>
      )}

      {receipt.receipts_items.map((item) => {
        const had = assignments[item.id] ?? []
        const lineTotal = item.qty * item.unit_price
        const names = bothNames(item.name, item.name_en, showEnglish)
        const status = itemStatus(had, lineTotal)
        return (
          <Card key={item.id} style={styles.itemCard}>
            <View style={styles.itemRow}>
              <View style={styles.flex}>
                <AppText variant="heading">{names.main}</AppText>
                <AppText variant="caption">
                  {names.other ? `${names.other} · ` : ''}
                  {item.qty} × {money(item.unit_price)}
                </AppText>
              </View>
              <View style={styles.priceColumn}>
                <AppText variant="heading" style={styles.amount}>
                  {money(lineTotal)}
                </AppText>
                {!alone && (
                  <AppText variant="caption" style={status.warn && { color: theme.warning, fontWeight: '600' }}>
                    {status.text}
                  </AppText>
                )}
              </View>
            </View>
            {!alone && (
              <View style={styles.chips}>
                {people.map((person) => (
                  <PersonChip
                    key={person.id}
                    name={nameOf(person)}
                    color={colorOf(person)}
                    selected={had.includes(person.id)}
                    onPress={() => togglePerson(item.id, person.id)}
                  />
                ))}
                {people.length > 2 && (
                  <Chip
                    label="Everyone"
                    dashed
                    selected={everyoneIds.every((personId) => had.includes(personId))}
                    onPress={() => toggleEveryone(item.id)}
                  />
                )}
              </View>
            )}
          </Card>
        )
      })}

      {charges.length > 0 && (
        <AppText variant="caption" style={styles.footnote}>
          Totals include {charges.join(' and ')}, shared in proportion.
        </AppText>
      )}
    </>
  )

  const paymentsTab = alone ? (
    <Card>
      <AppText variant="heading">Nothing to track yet</AppText>
      <AppText variant="muted">Add who was there on the Items tab. Then pick who paid and mark people as they pay back.</AppText>
      <Button title="Add people" variant="secondary" onPress={() => setTab('items')} />
    </Card>
  ) : (
    <>
      <Card>
        <AppText variant="heading">Who paid the bill?</AppText>
        <AppText variant="caption">Everyone else pays them back.</AppText>
        <View style={[styles.chips, styles.spaced]}>
          {people.map((person) => (
            <PersonChip
              key={person.id}
              role="radio"
              name={nameOf(person)}
              color={colorOf(person)}
              selected={person.is_payer}
              onPress={() => choosePayer(person)}
            />
          ))}
        </View>
      </Card>

      {payer && (
        <Card style={styles.paidCard}>
          <AppText variant="muted">Paid back to {payerName}</AppText>
          <View style={styles.paidTotal}>
            <AppText variant="display">{money(paidBack)}</AppText>
            <AppText variant="muted"> of {money(owedBack)}</AppText>
          </View>
          <ProgressBar value={owedBack > 0 ? paidBack / owedBack : 0} color={theme.success} />
          <View style={styles.paidRows}>
            {people.map((person, index) => (
              <View key={person.id} style={[styles.paidRow, index > 0 && { borderTopColor: theme.hairline, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <Avatar name={nameOf(person)} color={colorOf(person)} size={36} />
                <View style={styles.flex}>
                  <AppText variant="label">{nameOf(person)}</AppText>
                  <AppText variant="caption">
                    {person.is_payer
                      ? `Share ${money(totalOf(person))}`
                      : person.paid_at
                        ? `Paid ${money(totalOf(person))} back`
                        : `Owes ${money(totalOf(person))} to ${payerName}`}
                    {person.guest_key ? ' · picked via link' : ''}
                  </AppText>
                </View>
                {person.is_payer ? (
                  <Tag label="Paid the bill" />
                ) : (
                  <Pressable
                    onPress={() => togglePaid(person)}
                    hitSlop={4}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: !!person.paid_at }}
                    accessibilityLabel={`${nameOf(person)} paid ${payerName} back`}
                    style={({ pressed }) => [
                      styles.paidButton,
                      person.paid_at
                        ? { backgroundColor: theme.successSoft, borderColor: theme.success }
                        : { backgroundColor: theme.surface, borderColor: theme.primary },
                      { opacity: pressed ? 0.8 : 1 },
                    ]}>
                    <AppText variant="label" style={{ color: person.paid_at ? theme.success : theme.primary }}>
                      {person.paid_at ? '✓ Paid' : 'Mark paid'}
                    </AppText>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        </Card>
      )}

      {friendLinksAvailable &&
        (receipt.link_enabled ? (
          <Card>
            <View style={styles.linkStatus}>
              <View style={[styles.dot, { backgroundColor: theme.success }]} />
              <AppText variant="heading">Friend link is on</AppText>
            </View>
            <AppText variant="caption">
              {people.some((person) => person.guest_key)
                ? `${people
                    .filter((person) => person.guest_key)
                    .map((person) => person.name)
                    .join(', ')} picked their own items. Pull down to see new picks.`
                : 'Anyone with it can add their name and tick what they had. Pull down to see their picks.'}
            </AppText>
            <View style={[styles.buttons, styles.spaced]}>
              <Button title="Share again" variant="secondary" onPress={shareLink} loading={linkBusy} style={styles.flex} />
              <Button title="Turn off link" variant="danger" onPress={turnOffLink} disabled={linkBusy} style={styles.flex} />
            </View>
          </Card>
        ) : (
          <Card>
            <AppText variant="heading">Let friends pick</AppText>
            <AppText variant="caption">Send a link and friends tick their own items on the SlipShare website.</AppText>
            {shareLinkTile}
          </Card>
        ))}
    </>
  )

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title={title}
        subtitle={`Total ${money(receipt.total)}${payer && !alone ? ` · Paid by ${payerName}` : ''}`}
        right={
          hasTranslation ? (
            <Segmented
              accessibilityLabel="Item names"
              options={[
                { value: 'original', label: originalLanguage },
                { value: 'en', label: 'EN' },
              ]}
              value={showEnglish ? 'en' : 'original'}
              onChange={(value) => setShowEnglish(value === 'en')}
            />
          ) : null
        }>
        <Tabs
          tabs={[
            { value: 'items', label: 'Items' },
            { value: 'payments', label: 'Payments' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </ScreenHeader>

      {tab === 'items' && !alone && (
        <View style={[styles.strip, { backgroundColor: theme.surface, borderColor: theme.hairline }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.stripScroll}
            contentContainerStyle={styles.stripContent}>
            {people.map((person) => (
              <View key={person.id} style={[styles.stripCard, { borderColor: theme.hairline, backgroundColor: theme.surface }]}>
                <Avatar name={nameOf(person)} color={colorOf(person)} size={30} />
                <View>
                  <AppText variant="caption" numberOfLines={1}>
                    {nameOf(person)}
                  </AppText>
                  <AppText variant="label" style={styles.amount}>
                    {money(totalOf(person))}
                  </AppText>
                </View>
              </View>
            ))}
            {!editingPeople && (
              <Pressable
                onPress={() => setEditingPeople(true)}
                accessibilityRole="button"
                accessibilityLabel="Add or remove people"
                style={({ pressed }) => [
                  styles.stripCard,
                  styles.stripAdd,
                  { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
                ]}>
                <AppText variant="label" style={{ color: theme.primary }}>
                  + People
                </AppText>
              </Pressable>
            )}
          </ScrollView>
        </View>
      )}

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {tab === 'items' ? itemsTab : paymentsTab}
        <View style={styles.deleteRow}>
          <TextLink
            title={deleting ? 'Deleting…' : 'Delete receipt'}
            color={theme.danger}
            onPress={() => !deleting && confirmDelete()}
          />
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={[styles.footerBar, { backgroundColor: theme.surface, borderColor: theme.hairline }]}>
        <View style={styles.footer}>
          {tab === 'items' &&
            (alone ? (
              <View style={styles.footerRow}>
                <AppText variant="muted" style={styles.flex}>
                  Just you so far
                </AppText>
                <AppText variant="label" style={styles.amount}>
                  You {money(totalOf(people[0]))}
                </AppText>
              </View>
            ) : hasUnassigned ? (
              <View style={styles.footerProgress}>
                <View style={styles.footerRow}>
                  <AppText variant="label" style={[styles.flex, { color: theme.warning }]}>
                    {unassignedCount} item{unassignedCount === 1 ? '' : 's'} not assigned yet
                  </AppText>
                  <AppText variant="label" style={[styles.amount, { color: theme.warning }]}>
                    {money(split.unassigned.total)}
                  </AppText>
                </View>
                <ProgressBar value={assignedShare} />
              </View>
            ) : (
              <AppText variant="label" style={{ color: theme.success }}>
                ✓ Every item is assigned
              </AppText>
            ))}
          <Button title="Send totals" onPress={sendTotals} icon={<ShareIcon color={theme.onPrimary} />} />
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  deleteRow: { paddingVertical: Spacing.two },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  amount: { fontVariant: ['tabular-nums'] },
  stepCard: { gap: Spacing.three - 4 },
  stepHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  spaced: { marginTop: Spacing.one },
  personPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.pill,
    paddingLeft: Spacing.one + 2,
    paddingRight: Spacing.three,
    minHeight: 40,
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  suggestions: { gap: Spacing.two },
  linkTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three - 4,
  },
  linkIcon: { width: 36, height: 36, borderRadius: Radius.small + 2, alignItems: 'center', justifyContent: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.one },
  itemCard: { gap: Spacing.three - 4 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  priceColumn: { alignItems: 'flex-end' },
  footnote: { textAlign: 'center', marginTop: Spacing.one },
  paidCard: { gap: Spacing.two },
  paidTotal: { flexDirection: 'row', alignItems: 'baseline' },
  paidRows: { marginTop: Spacing.two },
  paidRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4, paddingVertical: Spacing.three - 4 },
  paidButton: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three - 2,
    minHeight: 38,
    justifyContent: 'center',
  },
  linkStatus: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 8, height: 8, borderRadius: 4 },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  strip: { borderBottomWidth: StyleSheet.hairlineWidth },
  stripScroll: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  stripContent: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2 },
  stripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two + 2,
    minWidth: 120,
  },
  stripAdd: { minWidth: 0, borderStyle: 'dashed', justifyContent: 'center' },
  footerBar: { borderTopWidth: StyleSheet.hairlineWidth },
  footer: {
    padding: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.three - 4,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  footerProgress: { gap: Spacing.two },
})
