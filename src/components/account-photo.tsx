import type { User } from '@supabase/supabase-js'
import { Image } from 'expo-image'
import { useState } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { Avatar } from '@/components/chip'
import { useTheme } from '@/hooks/use-theme'

/** Your sign-in photo when the provider gave one (Google), and a name for the initial. */
function accountLook(user: User | null | undefined) {
  const meta = user?.user_metadata ?? {}
  const photo = [meta.avatar_url, meta.picture].find((value) => typeof value === 'string' && value.startsWith('https://'))
  const name = [meta.display_name, meta.full_name, meta.name, user?.email].find(
    (value) => typeof value === 'string' && value.trim(),
  )
  return { photo: photo as string | undefined, name: (name as string | undefined) ?? '?' }
}

/** Your photo, or your initial on a blue circle, inside a white ring. */
export function AccountPhoto({
  user,
  size,
  ring = 2,
  style,
}: {
  user: User | null | undefined
  size: number
  ring?: number
  style?: StyleProp<ViewStyle>
}) {
  const theme = useTheme()
  const [broken, setBroken] = useState(false)
  const { photo, name } = accountLook(user)
  return (
    <View
      style={[
        styles.ring,
        { width: size + ring * 2, height: size + ring * 2, borderRadius: size, backgroundColor: theme.surface },
        style,
      ]}>
      {photo && !broken ? (
        <Image
          source={{ uri: photo }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setBroken(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Avatar name={name} color={theme.primary} size={size} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center' },
})
