// Shared by analytics.ts (phone) and analytics.web.ts (website).
//
// The funnel: split_created -> link_shared -> link_opened -> friend_joined -> slip_sent -> marked_paid.
// Events never carry names, items, amounts or link tokens.

export type AnalyticsEvent =
  | 'split_created'
  | 'link_shared'
  | 'link_opened'
  | 'friend_joined'
  | 'slip_sent'
  | 'totals_sent'
  | 'marked_paid'
  | 'all_settled'

export type AnalyticsProps = Record<string, string | number | boolean | null>

export const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY
export const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com'

/**
 * A route as a pattern, like /receipts/[id], built from Expo Router's segments,
 * so receipt ids and friend link tokens never leave the device.
 */
export function screenName(segments: string[]): string {
  const parts = segments.filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')))
  return '/' + parts.join('/')
}

/** Hides receipt ids and friend link tokens inside a URL or path. */
export function maskPath(value: string): string {
  return value.replace(/\/(pick|receipts)\/[^/?#]+/g, (_, route: string) => `/${route}/${route === 'pick' ? '[token]' : '[id]'}`)
}
