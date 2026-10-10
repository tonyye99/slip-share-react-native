import { Stack } from 'expo-router'

// Keeps the receipt list underneath a screen opened straight from a link.
export const unstable_settings = { initialRouteName: 'index' }

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ title: 'SlipShare' }} />
      <Stack.Screen name="scan" options={{ title: 'Scan receipt' }} />
      <Stack.Screen name="review" options={{ title: 'Review' }} />
      <Stack.Screen name="receipts/[id]" options={{ title: 'Split bill' }} />
      <Stack.Screen name="account" options={{ title: 'Account' }} />
    </Stack>
  )
}
