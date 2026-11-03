import { Stack } from 'expo-router'

import { useT } from '@/i18n'

export const unstable_settings = { anchor: 'index' }

export default function AppLayout() {
  const t = useT().screens
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: t.home }} />
      <Stack.Screen name="scan" options={{ title: t.scan }} />
      <Stack.Screen name="review" options={{ title: t.review }} />
      <Stack.Screen name="receipts/[id]" options={{ title: t.split }} />
      <Stack.Screen name="account" options={{ title: t.account }} />
      <Stack.Screen name="pay-methods" options={{ title: t.payMethods }} />
      <Stack.Screen name="pay-method" options={{ title: t.payMethods }} />
    </Stack>
  )
}
