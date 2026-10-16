import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AllSettled } from '@/components/all-settled'
import { BreakdownSheet } from '@/components/breakdown-sheet'
import { Avatar, Chip, InitialChip, usePersonColor } from '@/components/chip'
import { CheckIcon, DotsIcon, LinkIcon, PeopleIcon, PersonIcon, ShareIcon, TrashIcon } from '@/components/icons'
import { ProgressRing } from '@/components/progress-ring'
import { ScreenHeader } from '@/components/screen-header'
import { Sheet, SheetOption } from '@/components/sheet'
import { SwipeActions } from '@/components/swipe-actions'
import { AppText, Button, Card, Divider, Input, ProgressBar, Stepper, TextLink } from '@/components/ui'
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { confirmDestructive, showAlert } from '@/lib/alert'
import { friendLinksAvailable, friendLinkUrl } from '@/lib/link-picks'
import { bothNames, originalLabel } from '@/lib/names'
import {
  addItemPeople,
  addPerson,
  confirmDeleteReceipt,
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
import {
  evenCount,
  formatMoney,
  isCountable,
  itemShares,
  splitByPerson,
  totalsMessage,
  type Counts,
  type SplitResult,
} from '@/lib/split'
import type { ReceiptPerson, ReceiptWithPeople } from '@/lib/types'

const MAX_NAME_LENGTH = 40
const MAX_SUGGESTIONS = 6
const NOTHING: SplitResult = { subtotal: 0, tax: 0, service: 0, rounding: 0, total: 0, proportion: 0 }
const FRACTIONS: Record<number, string> = { 2: '½', 3: '⅓', 4: '¼', 5: '⅕', 6: '⅙', 8: '⅛' }
// The footer is see-through; browsers can also blur the list behind it.
const glassBlur = Platform.OS === 'web' ? ({ backdropFilter: 'blur(16px)' } as unknown as ViewStyle) : null

type Item = ReceiptWithPeople['receipts_items'][number]

/** Your own line reads "You" on screen. */
const nameOf = (person: ReceiptPerson) => (person.is_me ? 'You' : person.name)

/** Who had each item and how many of it: item id -> person id -> count. */
const picksOf = (receipt: ReceiptWithPeople): Counts =>
  Object.fromEntries(
    receipt.receipts_items.map((item) => [
      item.id,
      Object.fromEntries(item.receipt_item_people.map((row) => [row.person_id, row.units])),
    ]),
  )

/** How much of a line someone had, like "⅓" or "1 of 2". Empty when it was all theirs. */
function partOf(item: Item, share: number) {
  const lineTotal = item.qty * item.unit_price
  if (lineTotal <= 0 || share / lineTotal > 0.999) return ''
  const part = share / lineTotal
  const units = part * item.qty
  if (isCountable(item) && Math.abs(units - Math.round(units)) < 0.001) return `${Math.round(units)} of ${item.qty}`
  const parts = Math.round(1 / part)
  if (Math.abs(1 / parts - part) < 0.001) return FRACTIONS[parts] ?? `1/${parts}`
  return `${Math.round(part * 100)}%`
}

// iOS can't show the share sheet or another sheet until the last one has slid away.
const afterSheet = (run: () => void) => setTimeout(run, Platform.OS === 'ios' ? 400 : 0)

// The person who scanned the bill splits it: they add who was there, say who
// had each item (tap initials, or swipe a row) and send everyone their total.
// Tapping someone's card at the top marks them as paid back. Friends don't
// need the app.
export default function SplitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const theme = useTheme()
  const personColor = usePersonColor()
  const insets = useSafeAreaInsets()
  const [receipt, setReceipt] = useState<ReceiptWithPeople | null>(null)
  const [people, setPeople] = useState<ReceiptPerson[]>([])
  const [picks, setPicks] = useState<Counts>({})
  const [recentNames, setRecentNames] = useState<string[]>([])
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [showEnglish, setShowEnglish] = useState(false)
  const [linkBusy, setLinkBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  // Once people are added, the "Who was there?" card folds away until the menu opens it.
  const [editingPeople, setEditingPeople] = useState(false)
  // The person card that is open, showing what they owe.
  const [detailFor, setDetailFor] = useState<string | null>(null)
  // The item a right swipe asked "Who had it?" about.
  const [pickFor, setPickFor] = useState<string | null>(null)
  const [pickOpen, setPickOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [payerOpen, setPayerOpen] = useState(false)
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [settledOpen, setSettledOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Changes save as you tap. They reach the database one at a time and in
  // order, so quick taps on the same name can't land out of order.
  const saves = useRef<Promise<void>>(Promise.resolve())
  const scroll = useRef<ScrollView>(null)
  // Pulling the footer up opens the breakdown, like tapping it.
  const [pullUp] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy < -8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dy < -24) setBreakdownOpen(true)
      },
    }),
  )

  const show = useCallback((receipt: ReceiptWithPeople) => {
    setReceipt(receipt)
    setPeople(receipt.receipt_people)
    setPicks(picksOf(receipt))
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
            Object.fromEntries(Object.entries(picks).map(([itemId, had]) => [itemId, Object.keys(had)])),
            picks,
          )
        : null,
    [receipt, people, picks],
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
  const date = new Date(receipt.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const itemCount = receipt.receipts_items.length
  const everyoneIds = people.map((person) => person.id)
  const hasUnassigned = Math.abs(split.unassigned.total) >= 0.005
  const onBill = new Set(people.map((person) => person.name.toLowerCase()))
  const suggestions = recentNames.filter((name) => !onBill.has(name.toLowerCase())).slice(0, MAX_SUGGESTIONS)
  // Everyone except the payer pays the payer back.
  const owesPayer = payer ? people.filter((person) => !person.is_payer) : []
  const owedBack = owesPayer.reduce((sum, person) => sum + totalOf(person), 0)
  const paidBack = owesPayer.filter((person) => person.paid_at).reduce((sum, person) => sum + totalOf(person), 0)
  const settled = owesPayer.length > 0 && owesPayer.every((person) => person.paid_at)

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

  const peopleOn = (itemId: string) => Object.keys(picks[itemId] ?? {})
  const setItemPicks = (itemId: string, had: Record<string, number>) => setPicks((prev) => ({ ...prev, [itemId]: had }))
  // Everyone on the item, each with an even part of it.
  const evenly = (item: Item) =>
    Object.fromEntries(everyoneIds.map((personId) => [personId, evenCount(item, everyoneIds.length)]))
  const rowsFor = (itemId: string, had: Record<string, number>) =>
    Object.entries(had).map(([person_id, units]) => ({ item_id: itemId, person_id, units }))

  // A new tap is for one of the item; on lines like 2 × Egg Kim Bab, − 1 + changes it.
  const togglePerson = (itemId: string, personId: string) => {
    const had = picks[itemId] ?? {}
    if (personId in had) {
      setItemPicks(itemId, Object.fromEntries(Object.entries(had).filter(([id]) => id !== personId)))
      save(() => removeItemPeople(itemId, [personId]))
    } else {
      setItemPicks(itemId, { ...had, [personId]: 1 })
      save(() => addItemPeople([{ item_id: itemId, person_id: personId, units: 1 }]))
    }
  }

  const setUnits = (itemId: string, personId: string, units: number) => {
    setItemPicks(itemId, { ...picks[itemId], [personId]: units })
    save(() => addItemPeople([{ item_id: itemId, person_id: personId, units }]))
  }

  const shareWithEveryone = (item: Item) => {
    const even = evenly(item)
    setItemPicks(item.id, even)
    save(() => addItemPeople(rowsFor(item.id, even)))
  }

  const toggleEveryone = (item: Item) => {
    const had = peopleOn(item.id)
    if (everyoneIds.every((personId) => had.includes(personId))) {
      setItemPicks(item.id, {})
      save(() => removeItemPeople(item.id, everyoneIds))
    } else {
      shareWithEveryone(item)
    }
  }

  // The whole item goes to one person, all of it on lines like 2 × Egg Kim Bab.
  const giveTo = (item: Item, personId: string) => {
    const others = peopleOn(item.id).filter((other) => other !== personId)
    const units = isCountable(item) ? item.qty : 1
    setItemPicks(item.id, { [personId]: units })
    save(async () => {
      if (others.length > 0) await removeItemPeople(item.id, others)
      await addItemPeople([{ item_id: item.id, person_id: personId, units }])
    })
  }

  const splitEvenly = () => {
    const run = () => {
      const even = Object.fromEntries(receipt.receipts_items.map((item) => [item.id, evenly(item)]))
      setPicks(even)
      save(() => addItemPeople(Object.entries(even).flatMap(([itemId, had]) => rowsFor(itemId, had))))
    }
    if (!Object.values(picks).some((had) => Object.keys(had).length > 0)) return run()
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
      setPicks((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([itemId, had]) => [
            itemId,
            Object.fromEntries(Object.entries(had).filter(([id]) => id !== person.id)),
          ]),
        ),
      )
      if (detailFor === person.id) setDetailFor(null)
      save(() => removePerson(person.id))
    }
    if (!Object.values(picks).some((had) => person.id in had)) return remove()
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
    const next = people.map((other) =>
      other.id === person.id ? { ...other, paid_at: paid ? new Date().toISOString() : null } : other,
    )
    setPeople(next)
    save(() => setPersonPaid(person.id, paid))
    // The last person to pay back settles the bill.
    if (paid && next.filter((other) => !other.is_payer).every((other) => other.paid_at)) setSettledOpen(true)
  }

  const totalsText = () =>
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
    })
  const sendTotals = () => shareText(totalsText())

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
    confirmDeleteReceipt(async () => {
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
    })

  // Menu choices run once the menu has slid away.
  const fromMenu = (run: () => void) => {
    setMenuOpen(false)
    afterSheet(run)
  }

  const colorOf = (person: ReceiptPerson) => personColor(people.indexOf(person))
  const personById = (personId: string) => people.find((person) => person.id === personId)
  const sharesOf = (item: Item) => itemShares(item, peopleOn(item.id), picks[item.id])
  const unassignedCount = receipt.receipts_items.filter((item) => sharesOf(item).left > 0).length
  const assignedTotal = people.reduce((sum, person) => sum + totalOf(person), 0)
  const assignedShare = assignedTotal / (assignedTotal + split.unassigned.total || 1)
  const charges = [
    receipt.service_percent > 0 ? `${receipt.service_percent}% service` : null,
    receipt.tax_percent > 0 ? `${receipt.tax_percent}% VAT` : null,
  ].filter(Boolean)
  const included = [receipt.service_percent > 0 ? 'service' : null, receipt.tax_percent > 0 ? 'VAT' : null].filter(Boolean)
  const alone = people.length === 1
  const showPeopleStep = alone || editingPeople
  const nameOfItem = (item: Item) => bothNames(item.name, item.name_en, showEnglish).main

  // What an item's row says about who had it.
  const itemStatus = (item: Item, had: string[]) => {
    const { shares, left } = sharesOf(item)
    if (had.length === 0) return { text: 'Tap who had it', warn: true }
    if (left > 0) return { text: `${left} of ${item.qty} not assigned`, warn: true }
    if (had.length > 1) {
      const first = shares[had[0]]
      const even = had.every((personId) => Math.abs(shares[personId] - first) < 0.005)
      return { text: even ? `${money(first)} each` : 'Shared', warn: false }
    }
    const only = personById(had[0])
    return { text: !only || only.is_me ? 'All yours' : `All ${only.name}'s`, warn: false }
  }

  // Each person's part of every item they had, for the breakdown.
  const itemsOf = (person: ReceiptPerson) =>
    receipt.receipts_items.flatMap((item) => {
      const share = sharesOf(item).shares[person.id] ?? 0
      if (share < 0.005) return []
      const part = partOf(item, share)
      return [{ label: part ? `${nameOfItem(item)} · ${part}` : nameOfItem(item), amount: share }]
    })

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

  const summary = (
    <Card style={styles.summary}>
      <View style={styles.flex}>
        <AppText variant="caption">Bill total</AppText>
        <AppText style={[styles.billTotal, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {money(receipt.total)}
        </AppText>
        <AppText variant="caption">
          {[payer ? `Paid by ${payerName}` : null, included.length ? `incl. ${included.join(' and ')}` : null]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
        {settled ? (
          <Pressable onPress={() => setSettledOpen(true)} accessibilityRole="button" style={styles.settledLink}>
            <CheckIcon color={theme.success} size={14} weight={2} />
            <AppText variant="caption" style={{ color: theme.success, fontWeight: '700' }}>
              All settled
            </AppText>
          </Pressable>
        ) : paidBack > 0 ? (
          <AppText variant="caption" style={{ color: theme.success, fontWeight: '600' }}>
            {money(paidBack)} of {money(owedBack)} paid back
          </AppText>
        ) : null}
      </View>
      {!alone && (
        <ProgressRing
          value={assignedShare}
          label={hasUnassigned ? `${Math.min(99, Math.floor(assignedShare * 100))}%` : '100%'}
          caption="ASSIGNED"
          color={hasUnassigned ? theme.primary : theme.success}
          track={theme.backgroundElement}
        />
      )}
    </Card>
  )

  const personCards = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.cardsScroll}
      contentContainerStyle={styles.cards}>
      {people.map((person) => {
        const open = detailFor === person.id
        const color = colorOf(person)
        const paid = !person.is_payer && !!person.paid_at
        return (
          <Pressable
            key={person.id}
            onPress={() => setDetailFor(open ? null : person.id)}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={`${nameOf(person)}, ${money(totalOf(person))}${paid ? ', paid back' : ''}`}
            style={({ pressed }) => [
              styles.personCard,
              { backgroundColor: theme.surface, borderColor: open ? color : theme.hairline, opacity: pressed ? 0.85 : 1 },
            ]}>
            <View style={styles.personCardTop}>
              <Avatar name={nameOf(person)} color={color} size={22} />
              <AppText variant="caption" numberOfLines={1} style={styles.shrink}>
                {nameOf(person)}
              </AppText>
              {paid && <CheckIcon color={theme.success} size={14} weight={2} />}
            </View>
            <AppText variant="heading" style={[styles.amount, styles.personAmount]} numberOfLines={1}>
              {money(totalOf(person))}
            </AppText>
            <ProgressBar value={receipt.total > 0 ? totalOf(person) / receipt.total : 0} color={color} />
          </Pressable>
        )
      })}
    </ScrollView>
  )

  // What the open person card says, and the one thing to do about it.
  const detailPerson = people.find((person) => person.id === detailFor)
  const detailCard = (() => {
    if (!detailPerson || alone) return null
    const items = itemsOf(detailPerson).length
    const extra = [`${items} item${items === 1 ? '' : 's'}`, detailPerson.guest_key ? 'picked via link' : null]
    let status: string
    let tone: string = theme.textSecondary
    let action: ReactNode
    if (!payer) {
      status = 'Nobody is set as the payer yet'
      action = <Button title="Choose who paid" variant="secondary" onPress={() => setPayerOpen(true)} />
    } else if (detailPerson.is_payer) {
      status = 'Paid the bill'
      action = <Button title="Change who paid" variant="secondary" onPress={() => setPayerOpen(true)} />
    } else if (detailPerson.paid_at) {
      status = detailPerson.is_me ? `You paid ${payer.name} back` : `Paid ${payerName} back`
      tone = theme.success
      action = <Button title="Not paid yet" variant="secondary" onPress={() => togglePaid(detailPerson)} />
    } else {
      status = detailPerson.is_me ? `You owe ${payer.name}` : `Owes ${payerName}`
      tone = theme.warning
      action = (
        <Button
          title="Mark paid back"
          icon={<CheckIcon color={theme.onPrimary} size={16} weight={2} />}
          onPress={() => togglePaid(detailPerson)}
        />
      )
    }
    return (
      <Card style={[styles.detail, { borderColor: colorOf(detailPerson) }]}>
        <View style={styles.detailRow}>
          <Avatar name={nameOf(detailPerson)} color={colorOf(detailPerson)} size={36} />
          <View style={styles.flex}>
            <AppText variant="heading">{nameOf(detailPerson)}</AppText>
            <AppText variant="caption">
              <AppText variant="caption" style={{ color: tone, fontWeight: '600' }}>
                {status}
              </AppText>
              {' · '}
              {extra.filter(Boolean).join(' · ')}
            </AppText>
          </View>
          <AppText variant="title" style={[styles.amount, styles.detailAmount]}>
            {money(totalOf(detailPerson))}
          </AppText>
        </View>
        {action}
      </Card>
    )
  })()

  const itemRow = (item: Item, index: number) => {
    const had = peopleOn(item.id)
    const lineTotal = item.qty * item.unit_price
    const names = bothNames(item.name, item.name_en, showEnglish)
    const status = itemStatus(item, had)
    const { shares } = sharesOf(item)
    const everyoneOn = everyoneIds.every((personId) => had.includes(personId))
    const caption = [names.other, item.qty !== 1 ? `${item.qty} × ${money(item.unit_price)}` : null]
      .filter(Boolean)
      .join(' · ')
    const row = (
      <View
        style={[
          styles.itemRow,
          { backgroundColor: theme.surface },
          index > 0 && { borderTopColor: theme.hairline, borderTopWidth: StyleSheet.hairlineWidth },
        ]}>
        <View style={styles.itemTop}>
          <View style={styles.flex}>
            <AppText variant="heading">{names.main}</AppText>
            {caption ? <AppText variant="caption">{caption}</AppText> : null}
          </View>
          <AppText variant="heading" style={styles.amount}>
            {money(lineTotal)}
          </AppText>
        </View>
        {!alone && (
          <View style={styles.chipRow}>
            <View style={styles.initials}>
              {people.map((person) => (
                <InitialChip
                  key={person.id}
                  name={nameOf(person)}
                  color={colorOf(person)}
                  selected={had.includes(person.id)}
                  onPress={() => togglePerson(item.id, person.id)}
                  accessibilityLabel={`${nameOf(person)} had ${names.main}`}
                />
              ))}
              <Pressable
                onPress={() => toggleEveryone(item)}
                hitSlop={2}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: everyoneOn }}
                accessibilityLabel={`Everyone shared ${names.main}`}
                style={({ pressed }) => [
                  styles.allPill,
                  { backgroundColor: everyoneOn ? theme.text : theme.backgroundElement, opacity: pressed ? 0.8 : 1 },
                ]}>
                <AppText variant="label" style={{ color: everyoneOn ? theme.background : theme.text }}>
                  All
                </AppText>
              </Pressable>
            </View>
            <AppText variant="caption" style={[styles.status, status.warn && { color: theme.warning, fontWeight: '600' }]}>
              {status.text}
            </AppText>
          </View>
        )}
        {!alone && isCountable(item) && had.length > 0 && (
          <View style={[styles.counts, { borderTopColor: theme.hairline }]}>
            <AppText variant="caption">How many each had</AppText>
            {people
              .filter((person) => had.includes(person.id))
              .map((person) => (
                <View key={person.id} style={styles.countRow}>
                  <Avatar name={nameOf(person)} color={colorOf(person)} size={24} />
                  <AppText variant="label" numberOfLines={1} style={styles.flex}>
                    {nameOf(person)}
                  </AppText>
                  <AppText variant="caption" style={styles.amount}>
                    {money(shares[person.id] ?? 0)}
                  </AppText>
                  <Stepper
                    value={picks[item.id]?.[person.id] ?? 1}
                    max={item.qty}
                    onChange={(units) => setUnits(item.id, person.id, units)}
                    label={`${names.main} for ${nameOf(person)}`}
                  />
                </View>
              ))}
          </View>
        )}
      </View>
    )
    if (alone) return <View key={item.id}>{row}</View>
    return (
      <SwipeActions
        key={item.id}
        start={{
          label: 'Pick who',
          color: theme.primary,
          textColor: theme.onPrimary,
          icon: <PersonIcon color={theme.onPrimary} size={18} />,
          onAction: () => {
            setPickFor(item.id)
            setPickOpen(true)
          },
        }}
        end={{
          label: 'Everyone',
          color: theme.success,
          textColor: theme.onPerson,
          icon: <PeopleIcon color={theme.onPerson} size={18} />,
          onAction: () => shareWithEveryone(item),
        }}>
        {row}
      </SwipeActions>
    )
  }

  const pickItem = receipt.receipts_items.find((item) => item.id === pickFor)
  const menuIcon = (icon: ReactNode) => <View style={styles.menuIcon}>{icon}</View>
  const pickedByLink = people.filter((person) => person.guest_key).map((person) => person.name)

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <ScreenHeader
        plain
        title={title}
        subtitle={`${date} · ${itemCount} item${itemCount === 1 ? '' : 's'}`}
        right={
          <Pressable
            onPress={() => setMenuOpen(true)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="More options"
            style={({ pressed }) => [styles.menuButton, { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 }]}>
            <DotsIcon color={theme.text} size={18} />
          </Pressable>
        }
      />

      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {summary}
        {!alone && personCards}
        {detailCard}
        {showPeopleStep && peopleStep}

        {alone ? (
          <View style={styles.sectionRow}>
            <AppText variant="heading" style={styles.flex}>
              Step 2 · Who had what
            </AppText>
            <AppText variant="caption">
              {itemCount} item{itemCount === 1 ? '' : 's'}
            </AppText>
          </View>
        ) : (
          <View style={styles.sectionRow}>
            <AppText variant="title" style={[styles.flex, styles.sectionTitle]}>
              Who had what
            </AppText>
            <TextLink title="Split all evenly" onPress={splitEvenly} />
          </View>
        )}

        {!alone && hasUnassigned && (
          <View style={[styles.hint, { backgroundColor: theme.primarySoft }]}>
            <AppText variant="caption" style={{ color: theme.primary, fontWeight: '600' }}>
              ↔  Swipe left to share with everyone, right to pick who had it
            </AppText>
          </View>
        )}

        <Card style={styles.list}>{receipt.receipts_items.map(itemRow)}</Card>

        {charges.length > 0 && (
          <AppText variant="caption" style={styles.footnote}>
            Totals include {charges.join(' and ')}, shared in proportion.
          </AppText>
        )}
      </ScrollView>

      <View pointerEvents="box-none" style={[styles.footerWrap, { paddingBottom: insets.bottom + Spacing.three - 4 }]}>
        <View
          style={[styles.footer, { backgroundColor: theme.glass, borderColor: theme.hairline }, glassBlur]}
          {...pullUp.panHandlers}>
          <Pressable
            onPress={() => setBreakdownOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="See the breakdown"
            style={styles.footerSummary}>
            {alone ? (
              <>
                <AppText variant="heading" style={styles.amount}>
                  You {money(totalOf(people[0]))}
                </AppText>
                <AppText variant="caption">Just you so far</AppText>
              </>
            ) : hasUnassigned ? (
              <>
                <AppText variant="heading" style={[styles.amount, { color: theme.warning }]} numberOfLines={1}>
                  {money(split.unassigned.total)} left
                </AppText>
                <AppText variant="caption">
                  {unassignedCount} item{unassignedCount === 1 ? '' : 's'} to go
                </AppText>
              </>
            ) : (
              <>
                <AppText variant="heading" style={{ color: theme.success }}>
                  ✓ All assigned
                </AppText>
                <AppText variant="caption">See the breakdown</AppText>
              </>
            )}
          </Pressable>
          <Button
            title="Send totals"
            onPress={sendTotals}
            icon={<ShareIcon color={theme.onPrimary} />}
            style={styles.sendButton}
          />
        </View>
      </View>

      <BreakdownSheet
        visible={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
        total={receipt.total}
        people={people.map((person) => ({
          id: person.id,
          name: nameOf(person),
          color: colorOf(person),
          result: split.people[person.id] ?? NOTHING,
          items: itemsOf(person),
        }))}
        unassigned={{ items: unassignedCount, amount: split.unassigned.total }}
        servicePercent={receipt.service_percent}
        taxPercent={receipt.tax_percent}
        money={money}
        footer={
          <Button
            title="Send totals"
            icon={<ShareIcon color={theme.onPrimary} />}
            onPress={() => {
              setBreakdownOpen(false)
              afterSheet(sendTotals)
            }}
          />
        }
      />

      <Sheet
        visible={pickOpen && !!pickItem}
        onClose={() => setPickOpen(false)}
        title={pickItem ? `Who had ${nameOfItem(pickItem)}?` : undefined}
        right={pickItem ? <AppText variant="muted">{money(pickItem.qty * pickItem.unit_price)}</AppText> : null}>
        <AppText variant="muted" style={styles.sheetNote}>
          It all goes to who you pick. To share it between a few people, tap their initials on the item.
        </AppText>
        {pickItem &&
          people.map((person) => (
            <SheetOption
              key={person.id}
              label={nameOf(person)}
              icon={<Avatar name={nameOf(person)} color={colorOf(person)} size={32} />}
              selected={peopleOn(pickItem.id).includes(person.id)}
              onPress={() => {
                giveTo(pickItem, person.id)
                setPickOpen(false)
              }}
            />
          ))}
        {pickItem && (
          <SheetOption
            label="Everyone"
            detail="Split it evenly"
            icon={menuIcon(<PeopleIcon color={theme.text} size={18} />)}
            onPress={() => {
              shareWithEveryone(pickItem)
              setPickOpen(false)
            }}
          />
        )}
      </Sheet>

      <Sheet visible={payerOpen} onClose={() => setPayerOpen(false)} title="Who paid the bill?">
        <AppText variant="muted" style={styles.sheetNote}>
          Everyone else pays them back.
        </AppText>
        {people.map((person) => (
          <SheetOption
            key={person.id}
            role="radio"
            label={nameOf(person)}
            icon={<Avatar name={nameOf(person)} color={colorOf(person)} size={32} />}
            selected={person.is_payer}
            onPress={() => {
              choosePayer(person)
              setPayerOpen(false)
            }}
          />
        ))}
      </Sheet>

      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        {hasTranslation && (
          <SheetOption
            label={
              showEnglish ? `Show ${originalLanguage === 'ไทย' ? 'Thai' : 'original'} names` : 'Show English names'
            }
            icon={menuIcon(<AppText variant="label">{showEnglish ? originalLanguage.slice(0, 3) : 'EN'}</AppText>)}
            onPress={() => {
              setShowEnglish(!showEnglish)
              setMenuOpen(false)
            }}
          />
        )}
        <SheetOption
          label="Add or remove people"
          icon={menuIcon(<PeopleIcon color={theme.text} size={18} />)}
          onPress={() =>
            fromMenu(() => {
              setEditingPeople(true)
              scroll.current?.scrollTo({ y: 0, animated: true })
            })
          }
        />
        {!alone && (
          <SheetOption
            label="Change who paid"
            detail={payer ? `Now: ${nameOf(payer)}` : 'Nobody yet'}
            icon={menuIcon(<PersonIcon color={theme.text} size={18} />)}
            onPress={() => fromMenu(() => setPayerOpen(true))}
          />
        )}
        {friendLinksAvailable &&
          (receipt.link_enabled ? (
            <>
              <SheetOption
                label="Share the friend link again"
                detail={
                  pickedByLink.length > 0
                    ? `On · ${pickedByLink.join(', ')} picked their own items`
                    : 'On · pull down on this screen to see new picks'
                }
                icon={menuIcon(<LinkIcon color={theme.text} size={18} />)}
                onPress={() => fromMenu(shareLink)}
              />
              <SheetOption
                label="Turn off the friend link"
                destructive
                icon={menuIcon(<LinkIcon color={theme.danger} size={18} />)}
                onPress={() => fromMenu(turnOffLink)}
              />
            </>
          ) : (
            <SheetOption
              label="Share a friend link"
              detail="Friends tick their own items. No app or sign-up."
              icon={menuIcon(<LinkIcon color={theme.text} size={18} />)}
              onPress={() => fromMenu(shareLink)}
            />
          ))}
        <SheetOption
          label={deleting ? 'Deleting…' : 'Delete receipt'}
          destructive
          icon={menuIcon(<TrashIcon color={theme.danger} size={18} />)}
          onPress={() => !deleting && fromMenu(confirmDelete)}
        />
      </Sheet>

      <AllSettled
        visible={settledOpen && settled}
        onClose={() => setSettledOpen(false)}
        title={title}
        date={date}
        payerName={payerName ?? 'you'}
        paidBack={owedBack}
        people={people.map((person) => ({
          id: person.id,
          name: nameOf(person),
          color: colorOf(person),
          amount: totalOf(person),
          paidTheBill: person.is_payer,
        }))}
        total={receipt.total}
        money={money}
        onShare={() => shareText(`All settled ✓\n\n${totalsText()}`)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  content: {
    padding: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.three - 4,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  amount: { fontVariant: ['tabular-nums'] },
  menuButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  menuIcon: { width: 32, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three + 4, borderRadius: Radius.large + 4 },
  billTotal: { fontSize: 36, lineHeight: 44, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  settledLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, alignSelf: 'flex-start', marginTop: 2 },
  // The row of person cards runs edge to edge and scrolls when there are many.
  cardsScroll: { marginHorizontal: -Spacing.three, flexGrow: 0 },
  cards: { flexGrow: 1, gap: Spacing.two, paddingHorizontal: Spacing.three },
  personCard: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 108,
    gap: Spacing.one + 2,
    borderWidth: 1.5,
    borderRadius: Radius.large,
    padding: Spacing.three - 4,
  },
  personCardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2 },
  personAmount: { fontSize: 18, fontWeight: '700' },
  detail: { borderWidth: 1.5, gap: Spacing.three - 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4 },
  detailAmount: { fontSize: 22, lineHeight: 28 },
  stepCard: { gap: Spacing.three - 4 },
  stepHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
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
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.three },
  sectionTitle: { fontSize: 22, lineHeight: 28 },
  hint: { borderRadius: Radius.medium, paddingHorizontal: Spacing.three - 4, paddingVertical: Spacing.two + 2 },
  list: { padding: 0, gap: 0, overflow: 'hidden', borderRadius: Radius.large + 4 },
  itemRow: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three - 2, gap: Spacing.two + 2 },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  initials: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two + 2, flexShrink: 1 },
  allPill: { minWidth: 44, height: 40, borderRadius: 20, paddingHorizontal: Spacing.three - 4, alignItems: 'center', justifyContent: 'center' },
  status: { marginLeft: 'auto', textAlign: 'right', maxWidth: 130 },
  counts: { gap: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.three - 4 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  footnote: { textAlign: 'center', marginTop: Spacing.one },
  footerWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.three - 4 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: Radius.large + 6,
    padding: Spacing.two + 2,
    paddingLeft: Spacing.three,
    boxShadow: '0 8px 28px rgba(16, 24, 27, 0.14)',
  },
  footerSummary: { flex: 1, minHeight: 44, justifyContent: 'center' },
  sendButton: { paddingHorizontal: Spacing.four, borderRadius: Radius.medium + 2 },
  sheetNote: { paddingHorizontal: Spacing.two, marginTop: -Spacing.one },
})
