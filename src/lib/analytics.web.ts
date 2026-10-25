import posthogJs from 'posthog-js'

import { POSTHOG_HOST, POSTHOG_KEY, maskPath, type AnalyticsEvent, type AnalyticsProps } from '@/lib/analytics-events'

// Website: same events as the phone app (analytics.ts), sent with posthog-js.
// The page renders on the server too, so PostHog only starts in a browser.

// Every URL-like property PostHog adds ($current_url, $session_entry_url, ...).
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
        // Anonymous: no person profiles, and screens are sent by hand as patterns.
        person_profiles: 'identified_only',
        persistence: 'localStorage',
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        disable_surveys: true,
        capture_exceptions: true,
        // Friend link tokens open a receipt, so they never leave the browser.
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

/** True when the site was built with a PostHog key. */
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

/** The choice is saved in this browser. */
export async function setAnalyticsOn(on: boolean) {
  if (!started) return
  if (on) posthogJs.opt_in_capturing()
  else posthogJs.opt_out_capturing()
}
