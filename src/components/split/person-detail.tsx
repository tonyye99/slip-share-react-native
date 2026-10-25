import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import { Avatar } from '@/components/chip'
import { CheckIcon } from '@/components/icons'
import { SlipRow } from '@/components/split/slip-row'
import { AppText, Button, Card } from '@/components/ui'
import { Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'
import { nameOf, type Money } from '@/lib/split-view'
import type { ReceiptPerson } from '@/lib/types'

/** What an open person card says, and the one thing to do about it. */
export function PersonDetail({
  person,
  payer,
  color,
  total,
  itemCount,
  money,
  onChoosePayer,
  onTogglePaid,
}: {
  person: ReceiptPerson
  payer: ReceiptPerson | null
  color: string
  total: number
  itemCount: number
  money: Money
  onChoosePayer: () => void
  onTogglePaid: () => void
}) {
  const theme = useTheme()
  const { common, split: t } = useT()
  const payerName = (payer?.is_me ? common.youInSentence : payer?.name) ?? ''
  const extra = [common.items(itemCount), person.guest_key ? t.pickedViaLink : null].filter(Boolean)

  let status: string
  let tone: string = theme.textSecondary
  let action: ReactNode
  if (!payer) {
    status = t.noPayerYet
    action = <Button title={t.choosePayer} variant="secondary" onPress={onChoosePayer} />
  } else if (person.is_payer) {
    status = t.paidTheBill
    action = <Button title={t.changePayer} variant="secondary" onPress={onChoosePayer} />
  } else if (person.paid_at) {
    status = person.is_me ? t.youPaidBack(payer.name) : t.paidBack(payerName)
    tone = theme.success
    action = <Button title={t.notPaidYet} variant="secondary" onPress={onTogglePaid} />
  } else {
    status = person.is_me ? t.youOwe(payer.name) : t.owes(payerName)
    tone = theme.warning
    action = (
      <Button title={t.markPaidBack} icon={<CheckIcon color={theme.onPrimary} size={16} weight={2} />} onPress={onTogglePaid} />
    )
  }

  return (
    <Card style={[styles.detail, { borderColor: color }]}>
      <View style={styles.row}>
        <Avatar name={nameOf(person)} color={color} size={36} />
        <View style={styles.flex}>
          <AppText variant="heading">{nameOf(person)}</AppText>
          <AppText variant="caption">
            <AppText variant="caption" style={{ color: tone, fontWeight: '600' }}>
              {status}
            </AppText>
            {' · '}
            {extra.join(' · ')}
          </AppText>
        </View>
        <AppText variant="title" style={styles.amount}>
          {money(total)}
        </AppText>
      </View>
      {person.slip_path && (
        <>
          <SlipRow path={person.slip_path} sentAt={person.slip_at ?? null} name={nameOf(person)} />
          {payer && !person.is_payer && !person.paid_at && <AppText variant="caption">{t.slipCheck}</AppText>}
        </>
      )}
      {action}
    </Card>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  detail: { borderWidth: 1.5, gap: Spacing.three - 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4 },
  amount: { fontVariant: ['tabular-nums'], fontSize: 22, lineHeight: 28 },
})
