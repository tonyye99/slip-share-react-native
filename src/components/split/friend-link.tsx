import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'

import { LinkIcon } from '@/components/icons'
import { AppText, Button } from '@/components/ui'
import { Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

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
  const caption = !on
    ? 'They tick their own items.\nNo app or sign-up.'
    : pickedNames.length > 0
      ? `${pickedNames.join(', ')} picked. Pull down for new picks.`
      : 'Pull down to see their picks.'
  return (
    <View style={[styles.card, { backgroundColor: theme.primaryTint, borderColor: theme.primarySoft }]}>
      <View style={[styles.icon, styles.bigIcon, { backgroundColor: theme.primary }]}>
        <LinkIcon color={theme.onPrimary} size={22} />
      </View>
      <View style={styles.flex}>
        <AppText variant="label">{on ? 'Friend link is on' : 'Let friends pick'}</AppText>
        <AppText variant="caption">{caption}</AppText>
      </View>
      <Button title={on ? 'Share again' : 'Share link'} onPress={onShare} loading={busy} style={styles.button} />
    </View>
  )
}

/** The "Share a link" tile in "Who was there?". */
export function ShareLinkTile({ busy, onPress }: { busy: boolean; onPress: () => void }) {
  const theme = useTheme()
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
        <AppText variant="label">Share a link</AppText>
        <AppText variant="caption">Friends tick their own items. No app or sign-up.</AppText>
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
