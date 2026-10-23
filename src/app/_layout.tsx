import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { useColorScheme } from 'react-native'

import { Colors } from '@/constants/theme'
import { LanguageProvider } from '@/i18n'
import { AuthProvider, useAuth } from '@/lib/auth'

SplashScreen.preventAutoHideAsync()

function RootStack() {
  const { session, loading } = useAuth()

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync()
  }, [loading])

  if (loading) return null

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>
      {/* Links from outside the app work signed in or out. */}
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="pick/[token]" />
      <Stack.Screen name="reset-password" />
    </Stack>
  )
}

// Screen backgrounds behind transitions follow the app's own colours.
const navigationThemes = {
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: Colors.light.primary,
      background: Colors.light.background,
      card: Colors.light.surface,
      text: Colors.light.text,
      border: Colors.light.hairline,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: Colors.dark.primary,
      background: Colors.dark.background,
      card: Colors.dark.surface,
      text: Colors.dark.text,
      border: Colors.dark.hairline,
    },
  },
}

export default function RootLayout() {
  const colorScheme = useColorScheme()
  return (
    <ThemeProvider value={colorScheme === 'dark' ? navigationThemes.dark : navigationThemes.light}>
      <LanguageProvider>
        <AuthProvider>
          <RootStack />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}
