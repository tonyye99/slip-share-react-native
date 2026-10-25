import PostHog from 'posthog-react-native'

import { POSTHOG_HOST, POSTHOG_KEY, type AnalyticsEvent, type AnalyticsProps } from '@/lib/analytics-events'

// Phone app: usage stats and error reports go to PostHog. The website uses
// analytics.web.ts instead. Without EXPO_PUBLIC_POSTHOG_API_KEY nothing is sent.
// People stay anonymous: we never call identify(), so PostHog only sees a
// random id per install.

const client = POSTHOG_KEY
  ? new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      captureAppLifecycleEvents: true,
      errorTracking: {
        autocapture: { uncaughtExceptions: true, unhandledRejections: true, console: ['error'] },
      },
    })
  : null

/** True when the app was built with a PostHog key. */
export const analyticsAvailable = !!client

export function track(event: AnalyticsEvent, properties?: AnalyticsProps) {
  client?.capture(event, properties)
}

export function trackScreen(name: string) {
  client?.screen(name)
}

export function analyticsOn(): boolean {
  return !!client && !client.optedOut
}

/** The choice is saved on the device and kept across app starts. */
export async function setAnalyticsOn(on: boolean) {
  if (!client) return
  if (on) await client.optIn()
  else await client.optOut()
}
