import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'

import { LinkIcon } from '@/components/icons'
import { AppText, Button } from '@/components/ui'
import { Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'

/** The friend link card under the person cards: share it, or share it again once it's on. */
export function FriendLinkCard({
  on,
  pickedNames,
  busy,
  onShare,
}: {
  on: boolean
  /** People who picked their own items through the link. */
  pickedNames: string[]
  busy: boolean
  onShare: () => void
}) {
  const theme = useTheme()
  const t = useT().split
  const caption = !on
    ? t.linkOffCaption
    : pickedNames.length > 0
      ? t.linkPicked(pickedNames.join(', '))
      : t.linkPullDown
  return (
    <View style={[styles.card, { backgroundColor: theme.primaryTint, borderColor: theme.primarySoft }]}>
      <View style={[styles.icon, styles.bigIcon, { backgroundColor: theme.primary }]}>
        <LinkIcon color={theme.onPrimary} size={22} />
      </View>
      <View style={styles.flex}>
        <AppText variant="label">{on ? t.linkIsOn : t.letFriendsPick}</AppText>
        <AppText variant="caption">{caption}</AppText>
      </View>
      <Button title={on ? t.shareAgain : t.shareLink} onPress={onShare} loading={busy} style={styles.button} />
    </View>
  )
}

/** The "Share a link" tile in "Who was there?". */
export function ShareLinkTile({ busy, onPress }: { busy: boolean; onPress: () => void }) {
  const theme = useTheme()
  const t = useT().split
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: theme.primaryTint, borderColor: theme.primarySoft, opacity: busy ? 0.5 : pressed ? 0.8 : 1 },
      ]}>
      <View style={[styles.icon, { backgroundColor: theme.primary }]}>
        {busy ? <ActivityIndicator color={theme.onPrimary} /> : <LinkIcon color={theme.onPrimary} />}
      </View>
      <View style={styles.flex}>
        <AppText variant="label">{t.shareALink}</AppText>
        <AppText variant="caption">{t.linkTileCaption}</AppText>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    borderWidth: 1,
    borderRadius: Radius.large + 4,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three - 4,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three - 4,
  },
  icon: { width: 36, height: 36, borderRadius: Radius.small + 2, alignItems: 'center', justifyContent: 'center' },
  bigIcon: { width: 44, height: 44, borderRadius: Radius.medium },
  button: { minHeight: 44, paddingHorizontal: Spacing.three - 2, borderRadius: Radius.medium + 2 },
})
