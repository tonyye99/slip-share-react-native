import { Stack } from 'expo-router'

import { useT } from '@/i18n'

// Keeps the receipt list underneath a screen opened straight from a link.
export const unstable_settings = { anchor: 'index' }

// Each screen draws its own ScreenHeader, so the bars match on phone and web.
export default function AppLayout() {
  const t = useT().screens
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: t.home }} />
      <Stack.Screen name="scan" options={{ title: t.scan }} />
      <Stack.Screen name="review" options={{ title: t.review }} />
      <Stack.Screen name="receipts/[id]" options={{ title: t.split }} />
      <Stack.Screen name="account" options={{ title: t.account }} />
    </Stack>
  )
}
