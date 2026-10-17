import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import { Avatar } from '@/components/chip'
import { CheckIcon } from '@/components/icons'
import { AppText, Button, Card } from '@/components/ui'
import { Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { countLabel, nameOf, type Money } from '@/lib/split-view'
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
  const payerName = payer?.is_me ? 'you' : payer?.name
  const extra = [countLabel(itemCount, 'item'), person.guest_key ? 'picked via link' : null].filter(Boolean)

  let status: string
  let tone: string = theme.textSecondary
  let action: ReactNode
  if (!payer) {
    status = 'Nobody is set as the payer yet'
    action = <Button title="Choose who paid" variant="secondary" onPress={onChoosePayer} />
  } else if (person.is_payer) {
    status = 'Paid the bill'
    action = <Button title="Change who paid" variant="secondary" onPress={onChoosePayer} />
  } else if (person.paid_at) {
    status = person.is_me ? `You paid ${payer.name} back` : `Paid ${payerName} back`
    tone = theme.success
    action = <Button title="Not paid yet" variant="secondary" onPress={onTogglePaid} />
  } else {
    status = person.is_me ? `You owe ${payer.name}` : `Owes ${payerName}`
    tone = theme.warning
    action = (
      <Button title="Mark paid back" icon={<CheckIcon color={theme.onPrimary} size={16} weight={2} />} onPress={onTogglePaid} />
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
