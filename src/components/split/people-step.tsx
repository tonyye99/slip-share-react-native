import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { Avatar, Chip } from '@/components/chip'
import { AppText, Button, Card, Divider, Input } from '@/components/ui'
import { Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'
import { MAX_NAME_LENGTH } from '@/lib/names'
import { nameOf } from '@/lib/split-view'
import type { ReceiptPerson } from '@/lib/types'


/** "Who was there?": add and remove the people on the bill. */
export function PeopleStep({
  people,
  alone,
  colorOf,
  suggestions,
  adding,
  linkTile,
  onAdd,
  onRemove,
  onDone,
}: {
  people: ReceiptPerson[]
  /** Only you so far, so this is step 1 of splitting. */
  alone: boolean
  colorOf: (person: ReceiptPerson) => string
  /** Names from recent bills that aren't on this one. */
  suggestions: string[]
  adding: boolean
  /** "Share a link", when friends can add themselves. */
  linkTile: ReactNode
  /** Resolves true once the person is added. */
  onAdd: (name: string) => Promise<boolean>
  onRemove: (person: ReceiptPerson) => void
  onDone: () => void
}) {
  const theme = useTheme()
  const t = useT()
  const [newName, setNewName] = useState('')
  const add = async (name: string) => {
    if (await onAdd(name)) setNewName('')
  }

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.flex}>
          {alone && <AppText variant="overline">{t.split.stepOne}</AppText>}
          <AppText variant="title">{t.split.whoWasThere}</AppText>
        </View>
        {!alone && <Button title={t.common.done} size="small" variant="secondary" onPress={onDone} />}
      </View>
      <AppText variant="muted">
        {alone ? t.split.addEveryone : t.split.addOrRemove}
      </AppText>
      <View style={styles.chips}>
        {people.map((person) => (
          <View key={person.id} style={[styles.pill, { backgroundColor: person.is_me ? theme.primarySoft : theme.backgroundElement }]}>
            <Avatar name={nameOf(person)} color={colorOf(person)} size={26} />
            <AppText variant="label">{nameOf(person)}</AppText>
            {!person.is_me && (
              <Pressable
                onPress={() => onRemove(person)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t.split.removeName(person.name)}>
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
          placeholder={t.split.friendsName}
          maxLength={MAX_NAME_LENGTH}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          submitBehavior="submit"
          editable={!adding}
          // Opened from "+ Add", so go straight to typing a name.
          autoFocus={!alone}
          accessibilityLabel={t.split.nameToAdd}
          style={styles.flex}
        />
        <Button title={t.common.add} onPress={() => add(newName)} loading={adding} disabled={!newName.trim()} />
      </View>
      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          <AppText variant="caption">{t.split.fromRecentBills}</AppText>
          <View style={styles.chips}>
            {suggestions.map((name) => (
              <Chip key={name} role="button" label={`+  ${name}`} onPress={() => add(name)} accessibilityLabel={t.split.addName(name)} />
            ))}
          </View>
        </View>
      )}
      {linkTile && (
        <>
          <Divider label={t.split.orLetThemAdd} />
          {linkTile}
        </>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: Spacing.three - 4 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pill: {
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
})
