import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AllSettled } from '@/components/all-settled'
import { BreakdownSheet } from '@/components/breakdown-sheet'
import { usePersonColor } from '@/components/chip'
import { SendIcon } from '@/components/icons'
import { ScreenHeader } from '@/components/screen-header'
import { BillSummary } from '@/components/split/bill-summary'
import { FriendLinkCard, ShareLinkTile } from '@/components/split/friend-link'
import { ItemRow } from '@/components/split/item-row'
import { MAX_NAME_LENGTH, PeopleStep } from '@/components/split/people-step'
import { PersonCards } from '@/components/split/person-cards'
import { PersonDetail } from '@/components/split/person-detail'
import { SplitFooter } from '@/components/split/split-footer'
import { MenuButton, PayerSheet, SplitMenu } from '@/components/split/split-menu'
import { WhoHadSheet } from '@/components/split/who-had-sheet'
import { AppText, Button, Card, TextLink } from '@/components/ui'
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
import { evenCount, formatMoney, itemShares, splitByPerson, totalsMessage, type Counts, type SplitResult } from '@/lib/split'
import { afterSheet, countLabel, itemStatus, nameOf, partOf, picksOf, type Item } from '@/lib/split-view'
import type { ReceiptPerson, ReceiptWithPeople } from '@/lib/types'

const MAX_SUGGESTIONS = 6
const NOTHING: SplitResult = { subtotal: 0, tax: 0, service: 0, rounding: 0, total: 0, proportion: 0 }
const NO_STATUS = { text: '', warn: false }

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
  const [adding, setAdding] = useState(false)
  const [showEnglish, setShowEnglish] = useState(false)
  const [linkBusy, setLinkBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  // Once people are added, "Who was there?" folds away until the menu or "+ Add" opens it.
  const [editingPeople, setEditingPeople] = useState(false)
  // The person card that is open, showing what they owe.
  const [detailFor, setDetailFor] = useState<string | null>(null)
  // The item open in "Who had this?", from a tap or a right swipe.
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

  // ============ what the screen shows ============

  const money = (amount: number) => formatMoney(amount, receipt.currency)
  const totalOf = (person: ReceiptPerson) => split.people[person.id]?.total ?? 0
  const colorOf = (person: ReceiptPerson) => personColor(people.indexOf(person))
  const views = people.map((person) => ({ id: person.id, name: nameOf(person), color: colorOf(person) }))
  const alone = people.length === 1
  const payer = people.find((person) => person.is_payer) ?? null
  const payerName = payer?.is_me ? 'you' : payer?.name
  const title = bothNames(receipt.merchant_name, receipt.merchant_name_en, showEnglish).main || 'Receipt'
  const date = new Date(receipt.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const items = receipt.receipts_items
  const everyoneIds = people.map((person) => person.id)
  const onBill = new Set(people.map((person) => person.name.toLowerCase()))
  const suggestions = recentNames.filter((name) => !onBill.has(name.toLowerCase())).slice(0, MAX_SUGGESTIONS)
  const pickedByLink = people.filter((person) => person.guest_key).map((person) => person.name)

  const peopleOn = (itemId: string) => Object.keys(picks[itemId] ?? {})
  const sharesOf = (item: Item) => itemShares(item, peopleOn(item.id), picks[item.id])
  const statusOf = (item: Item) => itemStatus(item, peopleOn(item.id), sharesOf(item), people, money)
  const unassignedCount = items.filter((item) => sharesOf(item).left > 0).length
  const assignedTotal = people.reduce((sum, person) => sum + totalOf(person), 0)

  // Everyone except the payer pays the payer back, if they had anything. Someone
  // who had nothing doesn't hold up "All settled", as on the home screen.
  const owesSomething = (person: ReceiptPerson) => !person.is_payer && totalOf(person) >= 0.005
  const owesPayer = payer ? people.filter(owesSomething) : []
  const owedBack = owesPayer.reduce((sum, person) => sum + totalOf(person), 0)
  const paidBack = owesPayer.filter((person) => person.paid_at).reduce((sum, person) => sum + totalOf(person), 0)
  const settled = owesPayer.length > 0 && owesPayer.every((person) => person.paid_at)

  const included = [receipt.service_percent > 0 ? 'service' : null, receipt.tax_percent > 0 ? 'VAT' : null].filter(Boolean)
  const charges = [
    receipt.service_percent > 0 ? `${receipt.service_percent}% service` : null,
    receipt.tax_percent > 0 ? `${receipt.tax_percent}% VAT` : null,
  ].filter(Boolean)
  const summaryCaption = [payer ? `Paid by ${payerName}` : null, included.length ? `incl. ${included.join(' and ')}` : null]
    .filter(Boolean)
    .join(' · ')

  const itemName = (item: Item) => bothNames(item.name, item.name_en, showEnglish).main
  // Each person's part of every item they had, for the breakdown.
  const itemsOf = (person: ReceiptPerson) =>
    items.flatMap((item) => {
      const share = sharesOf(item).shares[person.id] ?? 0
      if (share < 0.005) return []
      const part = partOf(item, share)
      return [{ label: part ? `${itemName(item)} · ${part}` : itemName(item), amount: share }]
    })

  // ============ changes ============

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

  const toggleEveryone = (item: Item) => {
    const had = peopleOn(item.id)
    if (everyoneIds.every((personId) => had.includes(personId))) {
      setItemPicks(item.id, {})
      save(() => removeItemPeople(item.id, everyoneIds))
    } else {
      const even = evenly(item)
      setItemPicks(item.id, even)
      save(() => addItemPeople(rowsFor(item.id, even)))
    }
  }

  // On lines like 2 × Egg Kim Bab, how many someone had; 0 takes them off it.
  const setCount = (item: Item, personId: string, units: number) => {
    if (units <= 0) {
      if (personId in (picks[item.id] ?? {})) togglePerson(item.id, personId)
      return
    }
    setItemPicks(item.id, { ...picks[item.id], [personId]: units })
    save(() => addItemPeople([{ item_id: item.id, person_id: personId, units }]))
  }

  const splitEvenly = () => {
    const run = () => {
      const even = Object.fromEntries(items.map((item) => [item.id, evenly(item)]))
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
    if (!name || adding) return false
    const key = name.toLowerCase()
    if (key === 'you' || key === 'me') {
      showAlert('Already on this bill', "You're on every bill you scan.")
      return false
    }
    if (onBill.has(key)) {
      showAlert('Already on this bill', `${name} is already on this bill.`)
      return false
    }
    setAdding(true)
    try {
      const person = await addPerson(receipt.id, name)
      setPeople((prev) => [...prev, person])
      return true
    } catch (e) {
      console.error('Add person failed', e)
      showAlert(`Could not add ${name}`, 'Check your connection and try again.')
      return false
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

  const choosePayer = (personId: string) => {
    if (personId === payer?.id) return
    setPeople((prev) =>
      prev.map((other) => ({
        ...other,
        is_payer: other.id === personId,
        // The payer has nobody to pay back.
        paid_at: other.id === personId ? null : other.paid_at,
      })),
    )
    save(() => setPayer(receipt.id, personId))
  }

  const togglePaid = (person: ReceiptPerson) => {
    const paid = !person.paid_at
    const next = people.map((other) =>
      other.id === person.id ? { ...other, paid_at: paid ? new Date().toISOString() : null } : other,
    )
    setPeople(next)
    save(() => setPersonPaid(person.id, paid))
    // The last person to pay back settles the bill.
    if (paid && next.filter(owesSomething).every((other) => other.paid_at)) setSettledOpen(true)
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

  const openItem = (itemId: string) => {
    setPickFor(itemId)
    setPickOpen(true)
  }

  // ============ the screen ============

  const showPeopleStep = alone || editingPeople
  const detailPerson = alone ? undefined : people.find((person) => person.id === detailFor)
  const pickItem = items.find((item) => item.id === pickFor)
  const hasTranslation = !!receipt.merchant_name_en || items.some((item) => item.name_en)
  const left = split.unassigned.total

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <ScreenHeader
        plain
        title={title}
        subtitle={`${date} · ${countLabel(items.length, 'item')}`}
        right={
<MenuButton onPress={() => setMenuOpen(true)} />
        }
      />

      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <BillSummary
          total={receipt.total}
          caption={summaryCaption}
          progress={
            alone
              ? null
              : {
                  assignedItems: items.length - unassignedCount,
                  itemCount: items.length,
                  left,
                  share: assignedTotal / (assignedTotal + left || 1),
                }
          }
          settled={settled}
          paidBack={paidBack}
          owedBack={owedBack}
          money={money}
          onShowSettled={() => setSettledOpen(true)}
        />

        {!alone && (
          <PersonCards
            people={people.map((person, index) => ({
              ...views[index],
              total: totalOf(person),
              paidBack: !person.is_payer && !!person.paid_at,
            }))}
            openId={detailFor}
            billTotal={receipt.total}
            money={money}
            onToggle={(personId) => setDetailFor(detailFor === personId ? null : personId)}
            onAdd={() => {
              setDetailFor(null)
              setEditingPeople(true)
            }}
          />
        )}

        {detailPerson && (
          <PersonDetail
            person={detailPerson}
            payer={payer}
            color={colorOf(detailPerson)}
            total={totalOf(detailPerson)}
            itemCount={itemsOf(detailPerson).length}
            money={money}
            onChoosePayer={() => setPayerOpen(true)}
            onTogglePaid={() => togglePaid(detailPerson)}
          />
        )}

        {friendLinksAvailable && !showPeopleStep && (
          <FriendLinkCard on={receipt.link_enabled} pickedNames={pickedByLink} busy={linkBusy} onShare={shareLink} />
        )}

        {showPeopleStep && (
          <PeopleStep
            people={people}
            alone={alone}
            colorOf={colorOf}
            suggestions={suggestions}
            adding={adding}
            linkTile={friendLinksAvailable && !receipt.link_enabled ? <ShareLinkTile busy={linkBusy} onPress={shareLink} /> : null}
            onAdd={add}
            onRemove={confirmRemove}
            onDone={() => setEditingPeople(false)}
          />
        )}

        <View style={[styles.sectionRow, !alone && styles.sectionGap]}>
          {alone ? (
            <>
              <AppText variant="heading" style={styles.flex}>
                Step 2 · Who had what
              </AppText>
              <AppText variant="caption">{countLabel(items.length, 'item')}</AppText>
            </>
          ) : (
            <>
              <AppText variant="title" style={[styles.flex, styles.sectionTitle]}>
                Who had what
              </AppText>
              <View>
                <TextLink title="Split all evenly" onPress={splitEvenly} />
              </View>
            </>
          )}
        </View>

        <Card style={styles.list}>
          {items.map((item, index) => (
            <ItemRow
              key={item.id}
              item={item}
              showEnglish={showEnglish}
              had={peopleOn(item.id)}
              status={statusOf(item)}
              alone={alone}
              divider={index > 0}
              money={money}
              onOpen={() => openItem(item.id)}
            />
          ))}
        </Card>

        {charges.length > 0 && (
          <AppText variant="caption" style={styles.footnote}>
            Totals include {charges.join(' and ')}, shared in proportion.
          </AppText>
        )}
      </ScrollView>

      <SplitFooter
        alone={alone}
        myTotal={totalOf(people[0])}
        left={left}
        leftItems={unassignedCount}
        money={money}
        onOpenBreakdown={() => setBreakdownOpen(true)}
        onSend={sendTotals}
      />

      <BreakdownSheet
        visible={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
        total={receipt.total}
        people={people.map((person, index) => ({
          ...views[index],
          result: split.people[person.id] ?? NOTHING,
          items: itemsOf(person),
        }))}
        unassigned={{ items: unassignedCount, amount: left }}
        servicePercent={receipt.service_percent}
        taxPercent={receipt.tax_percent}
        money={money}
        footer={
          <Button
            title="Send totals"
            icon={<SendIcon color={theme.onPrimary} />}
            onPress={() => {
              setBreakdownOpen(false)
              afterSheet(sendTotals)
            }}
          />
        }
      />

      <WhoHadSheet
        visible={pickOpen}
        onClose={() => setPickOpen(false)}
        item={pickItem}
        showEnglish={showEnglish}
        people={views}
        counts={pickItem ? (picks[pickItem.id] ?? {}) : {}}
        shares={pickItem ? sharesOf(pickItem).shares : {}}
        status={pickItem ? statusOf(pickItem) : NO_STATUS}
        money={money}
        onToggleEveryone={() => pickItem && toggleEveryone(pickItem)}
        onTogglePerson={(personId) => pickItem && togglePerson(pickItem.id, personId)}
        onSetCount={(personId, units) => pickItem && setCount(pickItem, personId, units)}
      />

      <PayerSheet
        visible={payerOpen}
        onClose={() => setPayerOpen(false)}
        people={views}
        payerId={payer?.id}
        onChoose={choosePayer}
      />

      <SplitMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        translation={
          hasTranslation
            ? {
                showEnglish,
                originalLanguage: originalLabel([receipt.merchant_name, ...items.map((item) => item.name)]),
              }
            : null
        }
        onToggleEnglish={() => {
          setShowEnglish(!showEnglish)
          setMenuOpen(false)
        }}
        onEditPeople={() =>
          fromMenu(() => {
            setEditingPeople(true)
            scroll.current?.scrollTo({ y: 0, animated: true })
          })
        }
        canChangePayer={!alone}
        payerName={payer ? nameOf(payer) : undefined}
        onChangePayer={() => fromMenu(() => setPayerOpen(true))}
        link={friendLinksAvailable ? { on: receipt.link_enabled, pickedNames: pickedByLink } : null}
        onShareLink={() => fromMenu(shareLink)}
        onTurnOffLink={() => fromMenu(turnOffLink)}
        deleting={deleting}
        onDelete={() => fromMenu(confirmDelete)}
      />

      <AllSettled
        visible={settledOpen && settled}
        onClose={() => setSettledOpen(false)}
        title={title}
        date={date}
        payerName={payerName ?? 'you'}
        paidBack={owedBack}
        people={people.map((person, index) => ({
          ...views[index],
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  content: {
    padding: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.three - 4,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.three },
  sectionGap: { marginBottom: Spacing.one + 2 },
  sectionTitle: { fontSize: 22, lineHeight: 28 },
  list: { padding: 0, gap: 0, overflow: 'hidden', borderRadius: Radius.large + 4 },
  footnote: { textAlign: 'center', marginTop: Spacing.one },
})
