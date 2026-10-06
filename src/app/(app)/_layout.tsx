import { Stack } from 'expo-router'

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ title: 'SlipShare' }} />
      <Stack.Screen name="scan" options={{ title: 'Scan receipt' }} />
      <Stack.Screen name="review" options={{ title: 'Review' }} />
      <Stack.Screen name="receipts/[id]" options={{ title: 'Split bill' }} />
    </Stack>
  )
}
