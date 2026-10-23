import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { Avatar } from '@/components/chip'
import { DotsIcon, LinkIcon, PeopleIcon, PersonIcon, TrashIcon } from '@/components/icons'
import { Sheet, SheetOption } from '@/components/sheet'
import { AppText } from '@/components/ui'
import { Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'
import type { PersonView } from '@/lib/split-view'

const MenuIcon = ({ children }: { children: ReactNode }) => <View style={styles.icon}>{children}</View>

/** The ⋯ button in the header that opens the menu. */
export function MenuButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme()
  const t = useT()
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={t.split.moreOptions}
      style={({ pressed }) => [styles.button, { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 }]}>
      <DotsIcon color={theme.text} size={18} />
    </Pressable>
  )
}

/** The ⋯ menu on the split screen. */
export function SplitMenu({
  visible,
  onClose,
  translation,
  onToggleEnglish,
  onEditPeople,
  canChangePayer,
  payerName,
  onChangePayer,
  link,
  onShareLink,
  onTurnOffLink,
  deleting,
  onDelete,
}: {
  visible: boolean
  onClose: () => void
  /** Set when the receipt has English names to switch to. */
  translation: { showEnglish: boolean; originalLanguage: string } | null
  onToggleEnglish: () => void
  onEditPeople: () => void
  /** False while you're the only one on the bill. */
  canChangePayer: boolean
  payerName: string | undefined
  onChangePayer: () => void
  /** Set when friend links work here. */
  link: { on: boolean; pickedNames: string[] } | null
  onShareLink: () => void
  onTurnOffLink: () => void
  deleting: boolean
  onDelete: () => void
}) {
  const theme = useTheme()
  const t = useT().split
  return (
    <Sheet visible={visible} onClose={onClose}>
      {translation && (
        <SheetOption
          label={
            translation.showEnglish
              ? translation.originalLanguage === 'ไทย'
                ? t.showThaiNames
                : t.showOriginalNames
              : t.showEnglishNames
          }
          icon={
            <MenuIcon>
              <AppText variant="label">{translation.showEnglish ? translation.originalLanguage.slice(0, 3) : 'EN'}</AppText>
            </MenuIcon>
          }
          onPress={onToggleEnglish}
        />
      )}
      <SheetOption
        label={t.editPeople}
        icon={
          <MenuIcon>
            <PeopleIcon color={theme.text} size={18} />
          </MenuIcon>
        }
        onPress={onEditPeople}
      />
      {canChangePayer && (
        <SheetOption
          label={t.changePayer}
          detail={payerName ? t.payerNow(payerName) : t.nobodyYet}
          icon={
            <MenuIcon>
              <PersonIcon color={theme.text} size={18} />
            </MenuIcon>
          }
          onPress={onChangePayer}
        />
      )}
      {link &&
        (link.on ? (
          <>
            <SheetOption
              label={t.shareLinkAgain}
              detail={link.pickedNames.length > 0 ? t.linkOnPicked(link.pickedNames.join(', ')) : t.linkOnPullDown}
              icon={
                <MenuIcon>
                  <LinkIcon color={theme.text} size={18} />
                </MenuIcon>
              }
              onPress={onShareLink}
            />
            <SheetOption
              label={t.turnOffLink}
              destructive
              icon={
                <MenuIcon>
                  <LinkIcon color={theme.danger} size={18} />
                </MenuIcon>
              }
              onPress={onTurnOffLink}
            />
          </>
        ) : (
          <SheetOption
            label={t.shareFriendLink}
            detail={t.linkTileCaption}
            icon={
              <MenuIcon>
                <LinkIcon color={theme.text} size={18} />
              </MenuIcon>
            }
            onPress={onShareLink}
          />
        ))}
      <SheetOption
        label={deleting ? t.deleting : t.deleteReceipt}
        destructive
        icon={
          <MenuIcon>
            <TrashIcon color={theme.danger} size={18} />
          </MenuIcon>
        }
        onPress={() => !deleting && onDelete()}
      />
    </Sheet>
  )
}

/** "Who paid the bill?" */
export function PayerSheet({
  visible,
  onClose,
  people,
  payerId,
  onChoose,
}: {
  visible: boolean
  onClose: () => void
  people: PersonView[]
  payerId: string | undefined
  onChoose: (personId: string) => void
}) {
  const t = useT().split
  return (
    <Sheet visible={visible} onClose={onClose} title={t.whoPaid}>
      <AppText variant="muted" style={styles.note}>
        {t.everyoneElsePays}
      </AppText>
      {people.map((person) => (
        <SheetOption
          key={person.id}
          role="radio"
          label={person.name}
          icon={<Avatar name={person.name} color={person.color} size={32} />}
          selected={person.id === payerId}
          onPress={() => {
            onChoose(person.id)
            onClose()
          }}
        />
      ))}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  button: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 32, alignItems: 'center', justifyContent: 'center' },
  note: { paddingHorizontal: Spacing.two, marginTop: -Spacing.one },
})
