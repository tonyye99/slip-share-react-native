import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { Avatar, Chip } from '@/components/chip'
import { AppText, Button, Card, Divider, Input } from '@/components/ui'
import { Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { nameOf } from '@/lib/split-view'
import type { ReceiptPerson } from '@/lib/types'

export const MAX_NAME_LENGTH = 40

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
  const [newName, setNewName] = useState('')
  const add = async (name: string) => {
    if (await onAdd(name)) setNewName('')
  }

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.flex}>
          {alone && <AppText variant="overline">Step 1 of 2</AppText>}
          <AppText variant="title">Who was there?</AppText>
        </View>
        {!alone && <Button title="Done" size="small" variant="secondary" onPress={onDone} />}
      </View>
      <AppText variant="muted">
        {alone
          ? "Add everyone sharing this bill. Next, you'll tap who had each item."
          : 'Add or remove people. Items only a removed person had become unassigned.'}
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
          // Opened from "+ Add", so go straight to typing a name.
          autoFocus={!alone}
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
      {linkTile && (
        <>
          <Divider label="or let them add themselves" />
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
