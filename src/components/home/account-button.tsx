import type { User } from '@supabase/supabase-js'
import { router } from 'expo-router'
import { Pressable, StyleSheet } from 'react-native'

import { AccountPhoto } from '@/components/account-photo'
import { useT } from '@/i18n'

/** The round button at the top right of home that opens Account. */
export function AccountButton({ user }: { user: User | null | undefined }) {
  const t = useT()
  return (
    <Pressable
      onPress={() => router.push('/account')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t.home.account}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      <AccountPhoto user={user} size={36} style={styles.shadow} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  shadow: { boxShadow: '0 2px 8px rgba(16, 24, 27, 0.12)' },
})
