import { useState } from 'react'
import { Alert, ScrollView, StyleSheet } from 'react-native'

import { AppText, Button, Card } from '@/components/ui'
import { MaxContentWidth, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { deleteAccount } from '@/lib/account'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export default function AccountScreen() {
  const theme = useTheme()
  const { session } = useAuth()
  const [deleting, setDeleting] = useState(false)

  // Signing out locally sends the app back to the sign-in screen.
  const runDelete = async () => {
    setDeleting(true)
    try {
      await deleteAccount()
    } catch (e) {
      console.error('Delete account failed', e)
      setDeleting(false)
      Alert.alert('Could not delete your account', 'Please check your connection and try again.')
    }
  }

  const confirmDelete = () =>
    Alert.alert(
      'Delete your account?',
      "Your receipts and shares will be deleted for good, and friends will lose the bills you shared with them. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete account', style: 'destructive', onPress: runDelete },
      ],
    )

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <Card>
        <AppText variant="muted">Signed in as</AppText>
        <AppText variant="heading">{session?.user.email ?? 'Unknown'}</AppText>
        <Button title="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} disabled={deleting} />
      </Card>

      <Card>
        <AppText variant="heading">Delete account</AppText>
        <AppText variant="muted">
          Removes your account, every receipt you scanned and your shares on friends&apos; bills. Friends lose
          access to bills you shared. This also deletes your account on the SlipShare website.
        </AppText>
        <Button title="Delete account" variant="danger" onPress={confirmDelete} loading={deleting} />
      </Card>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
})
