import type { Ref } from 'react'
import { StyleSheet, Text, View, type ViewInstance } from 'react-native'

import { QrCode } from '@/components/qr-code'
import { Radius, Spacing } from '@/constants/theme'

const INK = '#10181B'
const MUTED = '#5B6B70'

export function TotalsCard({
  message,
  qr,
  caption,
  note,
  qrLabel,
  cardRef,
}: {
  message: string
  qr: string
  caption: string[]
  note: string
  qrLabel: string
  cardRef?: Ref<ViewInstance>
}) {
  return (
    <View ref={cardRef} collapsable={false} style={styles.card}>
      <Text style={styles.message} selectable>
        {message}
      </Text>
      <View style={styles.rule} />
      <View style={styles.qr}>
        <QrCode value={qr} size={176} accessibilityLabel={qrLabel} />
      </View>
      {caption.map((line, index) => (
        <Text key={line} style={index === 0 ? styles.name : styles.number}>
          {line}
        </Text>
      ))}
      <Text style={styles.note}>{note}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: '#E3E8EA',
    padding: Spacing.three,
    gap: Spacing.one,
  },
  message: { color: INK, fontSize: 15, lineHeight: 21 },
  rule: { height: 1, backgroundColor: '#E3E8EA', marginVertical: Spacing.two },
  qr: { alignSelf: 'center' },
  name: { color: INK, fontSize: 16, fontWeight: '700', textAlign: 'center', marginTop: Spacing.one },
  number: { color: INK, fontSize: 14, textAlign: 'center' },
  note: { color: MUTED, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: Spacing.one },
})
