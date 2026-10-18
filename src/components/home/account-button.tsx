import type { User } from '@supabase/supabase-js'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet } from 'react-native'

import { Avatar } from '@/components/chip'
import { useTheme } from '@/hooks/use-theme'

const SIZE = 36

/** Your sign-in photo when the provider gave one (Google, GitHub), else your initial. */
function look(user: User | null | undefined) {
  const meta = user?.user_metadata ?? {}
  const photo = [meta.avatar_url, meta.picture].find((value) => typeof value === 'string' && value.startsWith('https://'))
  const name = [meta.display_name, meta.full_name, meta.name, user?.email].find(
    (value) => typeof value === 'string' && value.trim(),
  )
  return { photo: photo as string | undefined, name: (name as string | undefined) ?? '?' }
}

/** The round button at the top right of home that opens Account. */
export function AccountButton({ user }: { user: User | null | undefined }) {
  const theme = useTheme()
  const [broken, setBroken] = useState(false)
  const { photo, name } = look(user)
  return (
    <Pressable
      onPress={() => router.push('/account')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Account"
      style={({ pressed }) => [styles.ring, { backgroundColor: theme.surface, opacity: pressed ? 0.8 : 1 }]}>
      {photo && !broken ? (
        <Image source={{ uri: photo }} style={styles.photo} onError={() => setBroken(true)} accessibilityIgnoresInvertColors />
      ) : (
        <Avatar name={name} color={theme.primary} size={SIZE} />
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  ring: {
    width: SIZE + 4,
    height: SIZE + 4,
    borderRadius: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(16, 24, 27, 0.12)',
  },
  photo: { width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
})
