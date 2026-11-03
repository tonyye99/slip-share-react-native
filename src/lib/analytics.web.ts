import posthogJs from 'posthog-js'

import { POSTHOG_HOST, POSTHOG_KEY, maskPath, type AnalyticsEvent, type AnalyticsProps } from '@/lib/analytics-events'

function hideTokens(values: Record<string, unknown> | undefined) {
  if (!values) return
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'string') values[key] = maskPath(value)
  }
}

const started =
  typeof window !== 'undefined' && !!POSTHOG_KEY
    ? (posthogJs.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        person_profiles: 'identified_only',
        persistence: 'localStorage',
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        disable_surveys: true,
        capture_exceptions: true,
        before_send: (event) => {
          if (!event) return event
          hideTokens(event.properties)
          hideTokens(event.$set as Record<string, unknown> | undefined)
          hideTokens(event.$set_once as Record<string, unknown> | undefined)
          return event
        },
      }),
      true)
    : false

export const analyticsAvailable = !!POSTHOG_KEY

export function track(event: AnalyticsEvent, properties?: AnalyticsProps) {
  if (started) posthogJs.capture(event, properties)
}

export function trackScreen(name: string) {
  if (started) posthogJs.capture('$screen', { $screen_name: name })
}

export function analyticsOn(): boolean {
  return started && !posthogJs.has_opted_out_capturing()
}

export async function setAnalyticsOn(on: boolean) {
  if (!started) return
  if (on) posthogJs.opt_in_capturing()
  else posthogJs.opt_out_capturing()
}
