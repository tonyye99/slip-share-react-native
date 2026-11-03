export type AnalyticsEvent =
  | 'split_created'
  | 'link_shared'
  | 'link_opened'
  | 'friend_joined'
  | 'slip_sent'
  | 'totals_sent'
  | 'marked_paid'
  | 'all_settled'
  | 'pay_method_saved'
  | 'pay_qr_saved'
  | 'pay_qr_uploaded'
  | 'totals_qr_sent'
  | 'totals_copied'

export type AnalyticsProps = Record<string, string | number | boolean | null>

export const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY
export const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com'

export function screenName(segments: string[]): string {
  const parts = segments.filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')))
  return '/' + parts.join('/')
}

export function maskPath(value: string): string {
  return value.replace(/\/(pick|receipts)\/[^/?#]+/g, (_, route: string) => `/${route}/${route === 'pick' ? '[token]' : '[id]'}`)
}
