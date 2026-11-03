import PostHog from 'posthog-react-native'

import { POSTHOG_HOST, POSTHOG_KEY, type AnalyticsEvent, type AnalyticsProps } from '@/lib/analytics-events'

const client = POSTHOG_KEY
  ? new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      captureAppLifecycleEvents: true,
      errorTracking: {
        autocapture: { uncaughtExceptions: true, unhandledRejections: true, console: ['error'] },
      },
    })
  : null

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

export async function setAnalyticsOn(on: boolean) {
  if (!client) return
  if (on) await client.optIn()
  else await client.optOut()
}
