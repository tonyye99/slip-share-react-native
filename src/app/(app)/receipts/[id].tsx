import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AllSettled } from '@/components/all-settled'
import { BreakdownSheet } from '@/components/breakdown-sheet'
import { usePersonColor } from '@/components/chip'
import { ChevronDownIcon, SendIcon } from '@/components/icons'
import { ScreenHeader } from '@/components/screen-header'
import { SendTotalsSheet } from '@/components/send-totals-sheet'
import { BillSummary } from '@/components/split/bill-summary'
import { FriendLinkCard, ShareLinkTile } from '@/components/split/friend-link'
import { ItemRow, PromotionRow } from '@/components/split/item-row'
import { MyItemRow, PaidBanner, WhoPaidCard } from '@/components/split/my-share'
import { PeopleRow, PeopleStep } from '@/components/split/people-step'
import { PersonCards } from '@/components/split/person-cards'
import { PersonDetail } from '@/components/split/person-detail'
import { SplitFooter } from '@/components/split/split-footer'
import { StartChoice } from '@/components/split/start-choice'
import { MenuButton, PayerSheet, RenameSheet, SoloPayerSheet, SplitMenu } from '@/components/split/split-menu'
import { WhoHadSheet } from '@/components/split/who-had-sheet'
import { AppText, Button, Card, TextLink } from '@/components/ui'
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { dateLocale, useT } from '@/i18n'
import { confirmDestructive, showAlert } from '@/lib/alert'
import { track } from '@/lib/analytics'
import { friendLinksAvailable, friendLinkUrl } from '@/lib/link-picks'
import { groupPayQr, withPayMe } from '@/lib/pay-lines'
import { listPayMethods, type PayMethod } from '@/lib/pay-methods'
import { bothNames, cleanName, originalLabel } from '@/lib/names'
import {
  addItemPeople,
  addPerson,
  confirmDeleteReceipt,
  deleteReceipt,
  getRecentNames,
  getReceipt,
  removeItemPeople,
  removePerson,
  renameReceipt,
  resetItemSplits,
  setPaidTheBill,
  setPayer,
  setPersonPaid,
  setReceiptLink,
  setSplitMode,
} from '@/lib/receipts'
import { shareText } from '@/lib/share-text'
import {
  evenCount,
  formatMoney,
  isDiscount,
  itemShares,
  myShareMessage,
  picksFrom,
  splitByPicks,
  splitsFrom,
  totalsMessage,
  type Counts,
  type SplitResult,
} from '@/lib/split'
import { afterSheet, discountText, itemStatus, nameOf, partOf, type Item } from '@/lib/split-view'
import type { ReceiptPerson, ReceiptWithPeople, SplitMode } from '@/lib/types'

const MAX_SUGGESTIONS = 6
const NOTHING: SplitResult = { subtotal: 0, discount: 0, tax: 0, service: 0, rounding: 0, total: 0, proportion: 0 }
const NO_STATUS = { text: '', warn: false }

export default function SplitScreen() {
  const { id, start } = useLocalSearchParams<{ id: string; start?: string }>()
  const theme = useTheme()
  const t = useT()
  const personColor = usePersonColor()
  const insets = useSafeAreaInsets()
  const [receipt, setReceipt] = useState<ReceiptWithPeople | null>(null)
  const [people, setPeople] = useState<ReceiptPerson[]>([])
  const [picks, setPicks] = useState<Counts>({})
  const [splits, setSplits] = useState<Counts>({})
  const [recentNames, setRecentNames] = useState<string[]>([])
  const [payMethods, setPayMethods] = useState<PayMethod[]>([])
  const [adding, setAdding] = useState(false)
  const [showEnglish, setShowEnglish] = useState(false)
  const [linkBusy, setLinkBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [editingPeople, setEditingPeople] = useState(false)
  const [detailFor, setDetailFor] = useState<string | null>(null)
  const [pickFor, setPickFor] = useState<string | null>(null)
  const [pickOpen, setPickOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [payerOpen, setPayerOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [showFree, setShowFree] = useState(false)
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [settledOpen, setSettledOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saves = useRef<Promise<void>>(Promise.resolve())
  const scroll = useRef<ScrollViewInstance>(null)

  const show = useCallback((receipt: ReceiptWithPeople) => {
    setReceipt(receipt)
    setPeople(receipt.receipt_people)
    setPicks(picksFrom(receipt.receipts_items))
    setSplits(splitsFrom(receipt.receipts_items))
  }, [])

  const notFound = t.split.notFound
  useEffect(() => {
    getReceipt(id)
      .then(show)
      .catch((e) => {
        console.error('Load failed', e)
        setError(notFound)
      })
    getRecentNames()
      .then(setRecentNames)
      .catch((e) => console.error('Could not load recent names', e))
    listPayMethods()
      .then(setPayMethods)
      .catch((e) => console.error('Could not load ways to get paid', e))
  }, [id, show, notFound])

  const split = useMemo(() => {
    if (!receipt) return null
    const mine = receipt.split_mode === 'mine'
    return splitByPicks(
      receipt,
      receipt.receipts_items,
      people.map((person) => person.id),
      picks,
      mine ? splits : {},
    )
  }, [receipt, people, picks, splits])

  if (error || !receipt || !split) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.background }]}>
        <ScreenHeader title={t.screens.split} />
        <View style={styles.centered}>{error ? <AppText variant="error">{error}</AppText> : <ActivityIndicator />}</View>
      </View>
    )
  }

  const money = (amount: number) => formatMoney(amount, receipt.currency)
  const mine = receipt.split_mode === 'mine'
  const asking = receipt.split_mode === null && start === '1'
  const totalOf = (person: ReceiptPerson) =>
    wholeBillMine && person.is_me ? receipt.total : (split.people[person.id]?.total ?? 0)
  const colorOf = (person: ReceiptPerson) => personColor(people.indexOf(person))
  const views = people.map((person) => ({ id: person.id, name: nameOf(person), color: colorOf(person) }))
  const payer = people.find((person) => person.is_payer) ?? null
  const me = people.find((person) => person.is_me)
  const payerName = payer?.is_me ? t.common.youInSentence : payer?.name
  const title = bothNames(receipt.merchant_name, receipt.merchant_name_en, showEnglish).main || t.common.receipt
  const date = new Date(receipt.created_at).toLocaleDateString(dateLocale(), { month: 'short', day: 'numeric' })
  const items = receipt.receipts_items
  const everyoneIds = people.map((person) => person.id)
  const onBill = new Set(people.map((person) => person.name.toLowerCase()))
  const suggestions = recentNames.filter((name) => !onBill.has(name.toLowerCase())).slice(0, MAX_SUGGESTIONS)
  const pickedByLink = people.filter((person) => person.guest_key).map((person) => person.name)

  const peopleOn = (itemId: string) => Object.keys(picks[itemId] ?? {})
  const others = people.filter((person) => !person.is_me)
  const friendPayer =
    others.length === 1 && others[0].is_payer && !items.some((item) => peopleOn(item.id).includes(others[0].id))
      ? others[0]
      : null
  const alone = others.length === 0 || friendPayer !== null
  const minePayers = others.filter((person) => person.is_payer)
  const minePayerNames = minePayers.map((person) => person.name)
  const sharesOf = (item: Item) => itemShares(item, peopleOn(item.id), picks[item.id], mine ? splits[item.id] : {})
  const statusOf = (item: Item) => itemStatus(item, peopleOn(item.id), sharesOf(item), people, money)
  const whoGets = (item: Item) =>
    discountText(
      peopleOn(item.id),
      (personId) => people.find((person) => person.id === personId)?.name ?? t.common.someone,
      me?.id,
    )
  const unassignedCount = items.filter((item) => sharesOf(item).left > 0).length
  const priced = items.filter((item) => item.qty * item.unit_price > 0)
  const free = items.filter((item) => item.qty * item.unit_price === 0)
  const promotions = items.filter(isDiscount)
  const mineCount = alone ? priced.filter((item) => peopleOn(item.id).length > 0).length : 0
  const wholeBillMine = !mine && alone && mineCount === 0
  const assignedTotal = people.reduce((sum, person) => sum + totalOf(person), 0)

  const owesSomething = (person: ReceiptPerson) => !person.is_payer && totalOf(person) >= 0.005
  const owesPayer = payer ? people.filter(owesSomething) : []
  const owedBack = owesPayer.reduce((sum, person) => sum + totalOf(person), 0)
  const paidBack = owesPayer.filter((person) => person.paid_at).reduce((sum, person) => sum + totalOf(person), 0)
  const settled = owesPayer.length > 0 && owesPayer.every((person) => person.paid_at)

  const hasCharges = receipt.service_percent > 0 || receipt.tax_percent > 0
  const summaryCaption = [hasCharges ? t.split.includes(receipt.service_percent > 0, receipt.tax_percent > 0) : null]
    .filter(Boolean)
    .join(' · ')

  const itemName = (item: Item) => bothNames(item.name, item.name_en, showEnglish).main
  const itemsOf = (person: ReceiptPerson) =>
    items.flatMap((item) => {
      const share = sharesOf(item).shares[person.id] ?? 0
      if (share < 0.005) return []
      const part = partOf(item, share)
      return [{ label: part ? `${itemName(item)} · ${part}` : itemName(item), amount: share }]
    })

  const save = (write: () => Promise<void>) => {
    saves.current = saves.current.then(() =>
      write().catch((e) => {
        console.error('Save failed', e)
        showAlert(t.split.saveFailed, t.common.checkConnection)
        return getReceipt(receipt.id)
          .then(show)
          .catch((loadError) => console.error('Reload failed', loadError))
      }),
    )
  }

  const setItemPicks = (itemId: string, had: Record<string, number>) => setPicks((prev) => ({ ...prev, [itemId]: had }))
  const evenly = (item: Item) =>
    Object.fromEntries(everyoneIds.map((personId) => [personId, evenCount(item, everyoneIds.length)]))
  const rowsFor = (itemId: string, had: Record<string, number>) =>
    Object.entries(had).map(([person_id, units]) => ({ item_id: itemId, person_id, units }))

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

  const toggleMine = (item: Item) => {
    const me = people.find((person) => person.is_me)
    if (!me) return
    if (peopleOn(item.id).includes(me.id)) {
      setItemPicks(item.id, {})
      save(() => removeItemPeople(item.id, [me.id]))
    } else {
      const had = { [me.id]: evenCount(item, 1) }
      setItemPicks(item.id, had)
      save(() => addItemPeople(rowsFor(item.id, had)))
    }
  }

  const chooseSoloPayer = async (friend: string | null) => {
    const me = people.find((person) => person.is_me)
    if (!me) return
    if (friend === null) {
      if (!friendPayer) return choosePayer(me.id)
      choosePayer(me.id)
      setPeople((prev) => prev.filter((other) => other.id !== friendPayer.id))
      save(() => removePerson(receipt.id, friendPayer.id))
      return
    }
    const name = cleanName(friend) || t.split.aFriend
    if (friendPayer?.name === name) return
    try {
      const person = await addPerson(receipt.id, name)
      setPeople((prev) =>
        [...prev.filter((other) => other.id !== friendPayer?.id), { ...person, is_payer: true }].map((other) => ({
          ...other,
          is_payer: other.id === person.id,
          paid_at: other.id === person.id ? null : other.paid_at,
        })),
      )
      save(async () => {
        await setPayer(receipt.id, person.id)
        if (friendPayer) await removePerson(receipt.id, friendPayer.id)
      })
    } catch (e) {
      console.error('Add person failed', e)
      showAlert(t.split.couldNotAdd(name), t.common.checkConnection)
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
      const even = Object.fromEntries(items.filter((item) => !isDiscount(item)).map((item) => [item.id, evenly(item)]))
      setPicks((prev) => ({ ...prev, ...even }))
      save(() => addItemPeople(Object.entries(even).flatMap(([itemId, had]) => rowsFor(itemId, had))))
    }
    if (!Object.values(picks).some((had) => Object.keys(had).length > 0)) return run()
    confirmDestructive(t.split.splitEvenlyTitle, t.split.splitEvenlyMessage, t.split.splitEvenly, run)
  }

  const add = async (typed: string) => {
    const name = cleanName(typed)
    if (!name || adding) return false
    const key = name.toLowerCase()
    if (key === 'you' || key === 'me' || key === t.common.you.toLowerCase()) {
      showAlert(t.split.alreadyOnBill, t.split.youreOnEveryBill)
      return false
    }
    if (onBill.has(key)) {
      showAlert(t.split.alreadyOnBill, t.split.nameAlreadyOnBill(name))
      return false
    }
    setAdding(true)
    try {
      const person = await addPerson(receipt.id, name)
      setPeople((prev) => [...prev, person])
      return true
    } catch (e) {
      console.error('Add person failed', e)
      showAlert(t.split.couldNotAdd(name), t.common.checkConnection)
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
      save(() => removePerson(receipt.id, person.id))
    }
    if (!Object.values(picks).some((had) => person.id in had)) return remove()
    confirmDestructive(t.split.removeTitle(person.name), t.split.removeMessage, t.common.remove, remove)
  }

  const choosePayer = (personId: string) => {
    if (personId === payer?.id) return
    setPeople((prev) =>
      prev.map((other) => ({
        ...other,
        is_payer: other.id === personId,
        paid_at: other.id === personId ? null : other.paid_at,
      })),
    )
    save(() => setPayer(receipt.id, personId))
  }

  const rename = (name: string) => {
    const before = receipt
    setReceipt({ ...receipt, merchant_name: name, merchant_name_en: null })
    renameReceipt(receipt.id, name).catch((e) => {
      console.error('Rename failed', e)
      setReceipt(before)
      showAlert(t.split.renameFailed, t.common.checkConnection)
    })
  }

  const togglePaid = (person: ReceiptPerson) => {
    const paid = !person.paid_at
    const next = people.map((other) =>
      other.id === person.id ? { ...other, paid_at: paid ? new Date().toISOString() : null } : other,
    )
    setPeople(next)
    save(() => setPersonPaid(person.id, paid))
    if (paid) track('marked_paid')
    if (paid && !alone && !mine && next.filter(owesSomething).every((other) => other.paid_at)) {
      track('all_settled', { people: next.length })
      setSettledOpen(true)
    }
  }

  const itemNamesOf = (person: ReceiptPerson) =>
    items.flatMap((item) => {
      const share = sharesOf(item).shares[person.id] ?? 0
      if (share < 0.005) return []
      const part = partOf(item, share)
      return [part ? `${itemName(item)} ${part}` : itemName(item)]
    })
  const totalsLine = (person: ReceiptPerson) => ({
    name: person.is_me ? t.totals.me : person.name,
    total: totalOf(person),
    subtotal: split.people[person.id]?.subtotal ?? 0,
    items: itemNamesOf(person),
    paid: !!person.paid_at,
  })
  const totalsText = (maths = false) =>
    totalsMessage({
      title,
      currency: receipt.currency,
      total: receipt.total,
      service_percent: receipt.service_percent,
      tax_percent: receipt.tax_percent,
      payer: payer ? (payer.is_me ? t.totals.paidByMe : payer.name) : null,
      people: people.map(totalsLine),
      unassigned: split.unassigned.total,
      maths,
    })
  const groupMessage = (maths: boolean) => (payer?.is_me ? withPayMe(totalsText(maths), payMethods) : totalsText(maths))
  const totalsQr = payer?.is_me ? groupPayQr(payMethods, receipt.currency) : null
  const owe =
    payer && !payer.is_me && me && totalOf(me) >= 0.005
      ? { payer: payer.name, amount: totalOf(me), paid: !!me.paid_at, line: totalsLine(me) }
      : null
  const owedTo = mine ? minePayerNames : owe ? [owe.payer] : []
  const myMessage = owe
    ? (maths: boolean) => myShareMessage({ title, currency: receipt.currency, me: owe.line, payers: owedTo, maths })
    : null
  const sendTotals = () => {
    if (mine && minePayers.length === 0) scroll.current?.scrollTo({ y: 0, animated: true })
    else setSendOpen(true)
  }
  const sendLabel = mine
    ? me?.paid_at && minePayers.length > 0
      ? t.mine.sendAgain
      : minePayers.length > 0
        ? t.mine.sendTo(t.mine.payers(minePayerNames))
        : t.mine.pickPayerFirst
    : owe
      ? t.split.sendMyShare
      : t.split.sendTotals

  const myUnits = (item: Item) => (me && me.id in (picks[item.id] ?? {}) ? (picks[item.id][me.id] ?? 1) : null)
  const myCount = priced.filter((item) => myUnits(item) !== null).length
  const paidBackMine = !!me?.paid_at && minePayers.length > 0

  const toggleMyItem = (item: Item) => {
    if (!me) return
    if (myUnits(item) !== null) setSplits((prev) => ({ ...prev, [item.id]: {} }))
    togglePerson(item.id, me.id)
  }

  const setMySplit = (item: Item, between: number) => {
    if (!me) return
    const units = myUnits(item) ?? 1
    setSplits((prev) => ({ ...prev, [item.id]: between > 1 ? { [me.id]: between } : {} }))
    save(() => addItemPeople([{ item_id: item.id, person_id: me.id, units, split_between: between }]))
  }

  const markMinePaid = () => {
    if (!me || me.paid_at) return
    togglePaid(me)
    setTimeout(() => scroll.current?.scrollTo({ y: 0, animated: true }), 0)
  }

  const changeMode = (mode: SplitMode) => {
    const splitItems = Object.keys(splits).filter((itemId) => Object.keys(splits[itemId]).length > 0)
    setReceipt((prev) => prev && { ...prev, split_mode: mode })
    const onePayer = minePayers.length === 0 ? me : minePayers.length > 1 ? minePayers[0] : null
    if (mode === 'everyone') setSplits({})
    if (mode === 'everyone' && onePayer) {
      setPeople((prev) =>
        prev.map((other) => ({
          ...other,
          is_payer: other.id === onePayer.id,
          paid_at: other.id === onePayer.id ? null : other.paid_at,
        })),
      )
    }
    setDetailFor(null)
    setEditingPeople(false)
    track('split_mode_chosen', { mode })
    save(async () => {
      await setSplitMode(receipt.id, mode)
      if (mode === 'everyone' && me) await resetItemSplits(splitItems, me.id)
      if (mode === 'everyone' && onePayer) await setPayer(receipt.id, onePayer.id)
    })
  }

  const addMinePayer = async (typed: string) => {
    const name = cleanName(typed)
    if (!name || adding || !me) return
    const key = name.toLowerCase()
    if (key === 'you' || key === 'me' || key === t.common.you.toLowerCase()) {
      showAlert(t.split.alreadyOnBill, t.split.youreOnEveryBill)
      return
    }
    const existing = others.find((person) => person.name.toLowerCase() === key)
    if (existing?.is_payer) return
    const first = minePayers.length === 0
    setAdding(true)
    try {
      const person = existing ?? (await addPerson(receipt.id, name))
      setPeople((prev) =>
        (existing ? prev : [...prev, person]).map((other) =>
          other.id === person.id
            ? { ...other, is_payer: true, paid_at: null }
            : first && other.is_payer
              ? { ...other, is_payer: false }
              : other,
        ),
      )
      save(() => (first ? setPayer(receipt.id, person.id) : setPaidTheBill(person.id, true)))
    } catch (e) {
      console.error('Add person failed', e)
      showAlert(t.split.couldNotAdd(name), t.common.checkConnection)
    } finally {
      setAdding(false)
    }
  }

  const removeMinePayer = (personId: string) => {
    const hasPicks = Object.values(picks).some((had) => personId in had)
    if (hasPicks) {
      setPeople((prev) => prev.map((other) => (other.id === personId ? { ...other, is_payer: false } : other)))
      save(() => setPaidTheBill(personId, false))
      return
    }
    setPeople((prev) => prev.filter((other) => other.id !== personId))
    save(() => removePerson(receipt.id, personId))
  }

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
        showAlert(t.split.linkFailed, t.common.checkConnection)
        return
      } finally {
        setLinkBusy(false)
      }
    }
    track('link_shared')
    await shareText(t.split.linkMessage(title, friendLinkUrl(token)))
  }

  const turnOffLink = () =>
    confirmDestructive(
      t.split.turnOffTitle,
      t.split.turnOffMessage,
      t.split.turnOff,
      async () => {
        setLinkBusy(true)
        try {
          await setReceiptLink(receipt.id, false)
          setReceipt({ ...receipt, link_enabled: false })
        } catch (e) {
          console.error('Link off failed', e)
          showAlert(t.split.turnOffFailed, t.common.checkConnection)
        } finally {
          setLinkBusy(false)
        }
      },
    )

  const confirmDelete = () =>
    confirmDeleteReceipt(async () => {
      setDeleting(true)
      try {
        await saves.current
        await deleteReceipt(receipt.id)
        if (router.canGoBack()) router.back()
        else router.replace('/')
      } catch (e) {
        console.error('Delete receipt failed', e)
        setDeleting(false)
        showAlert(t.split.deleteFailed, t.common.checkConnection)
      }
    })

  const fromMenu = (run: () => void) => {
    setMenuOpen(false)
    afterSheet(run)
  }

  const openItem = (itemId: string) => {
    setPickFor(itemId)
    setPickOpen(true)
  }

  const showPeopleStep = editingPeople
  const detailPerson = alone ? (owe ? me : undefined) : people.find((person) => person.id === detailFor)
  const pickItem = items.find((item) => item.id === pickFor)
  const hasTranslation = !!receipt.merchant_name_en || items.some((item) => item.name_en)
  const left = split.unassigned.total
  const itemCount = items.length - promotions.length

  if (asking) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.background }]}>
        <ScreenHeader plain title={title} subtitle={`${date} · ${money(receipt.total)} · ${t.common.items(itemCount)}`} />
        <ScrollView style={styles.flex} contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.four }}>
          <StartChoice onChoose={changeMode} />
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <ScreenHeader
        plain
        title={title}
        subtitle={mine ? `${date} · ${money(receipt.total)}` : `${date} · ${t.common.items(itemCount)}`}
        onTitlePress={() => setRenameOpen(true)}
        titleHint={t.split.tapToRename}
        right={<MenuButton onPress={() => setMenuOpen(true)} />}
      />

      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {mine && paidBackMine && me?.paid_at && (
          <PaidBanner
            payer={t.mine.payers(minePayerNames)}
            amount={money(totalOf(me))}
            date={new Date(me.paid_at).toLocaleDateString(dateLocale(), { month: 'short', day: 'numeric' })}
            onUndo={() => togglePaid(me)}
          />
        )}

        {mine && !paidBackMine && (
          <WhoPaidCard
            payers={minePayers.map((person) => ({ id: person.id, name: person.name, color: colorOf(person) }))}
            busy={adding}
            onAdd={addMinePayer}
            onRemove={removeMinePayer}
          />
        )}

        {mine && me && (
          <Card style={styles.list}>
            <View style={styles.listHeader}>
              <View style={styles.flex}>
                <AppText variant="title" style={styles.sectionTitle}>
                  {paidBackMine ? t.mine.whatYouHad : t.split.whatDidYouHave}
                </AppText>
                <AppText variant="caption">
                  {paidBackMine ? t.split.paidBy(t.mine.payers(minePayerNames)) : t.split.tickIfYouHadItAll}
                </AppText>
              </View>
            </View>
            {priced.map((item) => (
              <MyItemRow
                key={item.id}
                item={item}
                showEnglish={showEnglish}
                units={myUnits(item)}
                splitBetween={splits[item.id]?.[me.id] ?? 1}
                share={sharesOf(item).shares[me.id] ?? 0}
                money={money}
                onToggle={() => toggleMyItem(item)}
                onUnits={(units) => setCount(item, me.id, units)}
                onSplit={(between) => setMySplit(item, between)}
              />
            ))}
            {promotions.map((item) => (
              <PromotionRow
                key={item.id}
                item={item}
                showEnglish={showEnglish}
                money={money}
                who={whoGets(item)}
                checked={peopleOn(item.id).includes(me.id)}
                onPress={() => togglePerson(item.id, me.id)}
              />
            ))}
          </Card>
        )}

        {!mine && (
          <>
            <BillSummary
              total={receipt.total}
              caption={summaryCaption}
              payer={{
                label: payer && payerName ? t.split.paidBy(payerName) : t.split.choosePayer,
                person: payer ? views[people.indexOf(payer)] : null,
              }}
              onChoosePayer={() => setPayerOpen(true)}
              progress={
                alone
                  ? null
                  : {
                      assignedItems: items.length - promotions.length - unassignedCount,
                      itemCount: items.length - promotions.length,
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
                  slipSent: !!person.slip_path,
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
                itemCount={wholeBillMine ? priced.length : itemsOf(detailPerson).length}
                money={money}
                onChoosePayer={() => setPayerOpen(true)}
                onTogglePaid={() => togglePaid(detailPerson)}
                onRemove={() => confirmRemove(detailPerson)}
              />
            )}

            {alone && !showPeopleStep && <PeopleRow people={people} colorOf={colorOf} onAdd={() => setEditingPeople(true)} />}

            {friendLinksAvailable && !alone && !showPeopleStep && (
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

            <Card style={styles.list}>
              <View style={styles.listHeader}>
                <View style={styles.flex}>
                  <AppText variant="title" style={styles.sectionTitle}>
                    {alone ? t.split.whatDidYouHave : t.split.whoHadWhat}
                  </AppText>
                  <AppText variant="caption">{alone ? t.split.tickIfYouHadItAll : t.common.items(priced.length)}</AppText>
                </View>
                {!alone && <TextLink title={t.split.splitAllEvenly} onPress={splitEvenly} />}
              </View>
              {[...priced, ...(showFree ? free : [])].map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  showEnglish={showEnglish}
                  had={peopleOn(item.id)}
                  status={statusOf(item)}
                  alone={alone}
                  divider
                  money={money}
                  onOpen={() => (alone ? toggleMine(item) : openItem(item.id))}
                />
              ))}
              {promotions.map((item) => (
                <PromotionRow
                  key={item.id}
                  item={item}
                  showEnglish={showEnglish}
                  money={money}
                  who={whoGets(item)}
                  checked={alone && me ? peopleOn(item.id).includes(me.id) : undefined}
                  onPress={() => (alone ? toggleMine(item) : openItem(item.id))}
                />
              ))}
              {free.length > 0 && (
                <Pressable
                  onPress={() => setShowFree(!showFree)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showFree }}
                  style={({ pressed }) => [
                    styles.freeRow,
                    { borderTopColor: theme.hairline, backgroundColor: pressed ? theme.backgroundElement : theme.surface },
                  ]}>
                  <AppText variant="caption" style={styles.flex}>
                    {showFree ? t.split.hideFree : t.split.freeItems(free.length)}
                  </AppText>
                  <ChevronDownIcon color={theme.textSecondary} up={showFree} />
                </Pressable>
              )}
            </Card>
          </>
        )}

        {hasCharges && (
          <AppText variant="caption" style={styles.footnote}>
            {t.split.sharedCharges(receipt.service_percent, receipt.tax_percent)}
          </AppText>
        )}

        {mine && owe && !owe.paid && (
          <View style={styles.alreadyPaid}>
            <TextLink title={t.mine.alreadyPaid(t.mine.payers(owedTo))} onPress={markMinePaid} />
          </View>
        )}
      </ScrollView>

      <SplitFooter
        alone={alone}
        myTotal={me ? totalOf(me) : 0}
        mineCount={mineCount}
        itemCount={priced.length}
        left={left}
        leftItems={unassignedCount}
        money={money}
        owe={owe}
        mine={mine ? { payers: minePayerNames, paid: paidBackMine, count: myCount } : null}
        onOpenBreakdown={() => setBreakdownOpen(true)}
        onSend={sendTotals}
      />

      <BreakdownSheet
        visible={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
        total={receipt.total}
        people={people
          .map((person, index) => ({
            ...views[index],
            result: split.people[person.id] ?? NOTHING,
            items: itemsOf(person),
          }))
          .filter((person) => !mine || person.id === me?.id)}
        unassigned={mine ? { items: 0, amount: 0 } : { items: unassignedCount, amount: left }}
        servicePercent={receipt.service_percent}
        taxPercent={receipt.tax_percent}
        money={money}
        footer={
          <Button
            title={sendLabel}
            icon={<SendIcon color={theme.onPrimary} />}
            onPress={() => {
              setBreakdownOpen(false)
              afterSheet(sendTotals)
            }}
          />
        }
      />

      <SendTotalsSheet
        visible={sendOpen}
        onClose={() => setSendOpen(false)}
        message={mine ? null : groupMessage}
        myMessage={myMessage}
        qr={totalsQr}
        onSentMine={() => {
          if (mine) markMinePaid()
          else if (me && !me.paid_at) togglePaid(me)
        }}
      />

      <WhoHadSheet
        visible={pickOpen}
        onClose={() => setPickOpen(false)}
        item={pickItem}
        showEnglish={showEnglish}
        people={views}
        meId={me?.id}
        counts={pickItem ? (picks[pickItem.id] ?? {}) : {}}
        shares={pickItem ? sharesOf(pickItem).shares : {}}
        status={pickItem ? statusOf(pickItem) : NO_STATUS}
        money={money}
        onToggleEveryone={() => pickItem && toggleEveryone(pickItem)}
        onTogglePerson={(personId) => pickItem && togglePerson(pickItem.id, personId)}
        onSetCount={(personId, units) => pickItem && setCount(pickItem, personId, units)}
      />

      <RenameSheet
        key={renameOpen ? 'rename-open' : 'rename-closed'}
        visible={renameOpen}
        onClose={() => setRenameOpen(false)}
        name={bothNames(receipt.merchant_name, receipt.merchant_name_en, showEnglish).main}
        onSave={rename}
      />

      {alone ? (
        <SoloPayerSheet
          key={payerOpen ? 'open' : 'closed'}
          visible={payerOpen}
          onClose={() => setPayerOpen(false)}
          friendName={friendPayer?.name ?? null}
          onChoose={chooseSoloPayer}
        />
      ) : (
        <PayerSheet
          visible={payerOpen}
          onClose={() => setPayerOpen(false)}
          people={views}
          payerId={payer?.id}
          onChoose={choosePayer}
        />
      )}

      <SplitMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        translation={
          hasTranslation
            ? {
                showEnglish,
                originalLanguage: originalLabel([receipt.merchant_name, ...items.map((item) => item.name)], t.names.original),
              }
            : null
        }
        onToggleEnglish={() => {
          setShowEnglish(!showEnglish)
          setMenuOpen(false)
        }}
        mine={mine}
        onSwitchMode={() => fromMenu(() => changeMode(mine ? 'everyone' : 'mine'))}
        onRename={() => fromMenu(() => setRenameOpen(true))}
        onEditPeople={() =>
          fromMenu(() => {
            setEditingPeople(true)
            scroll.current?.scrollTo({ y: 0, animated: true })
          })
        }
        canChangePayer
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
        payerName={payerName ?? t.common.youInSentence}
        paidBack={owedBack}
        people={people.map((person, index) => ({
          ...views[index],
          amount: totalOf(person),
          paidTheBill: person.is_payer,
        }))}
        total={receipt.total}
        money={money}
        onShare={() => shareText(t.split.settledMessage(totalsText()))}
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
  sectionTitle: { fontSize: 22, lineHeight: 28 },
  list: { padding: 0, gap: 0, overflow: 'hidden', borderRadius: Radius.large + 4 },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three - 4,
  },
  footnote: { textAlign: 'center', marginTop: Spacing.one },
  alreadyPaid: { alignSelf: 'center', marginTop: Spacing.one },
  freeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three - 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
})
