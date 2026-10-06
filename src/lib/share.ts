import * as Linking from 'expo-linking'
import { Share } from 'react-native'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isShareToken(value: string): boolean {
  return UUID.test(value)
}

/** slipshare://join/<token> in builds, exp://… in Expo Go. */
export function shareLink(shareToken: string): string {
  return Linking.createURL(`join/${shareToken}`)
}

export async function shareReceipt(shareToken: string, merchant: string | null) {
  const url = shareLink(shareToken)
  const what = merchant ? `the ${merchant} bill` : 'this bill'
  // The link goes in the message only; passing `url` too makes iOS share it twice.
  await Share.share({ message: `Pick what you had from ${what} on SlipShare: ${url}` })
}

// A join link opened while signed out is remembered here and resumed after sign-in.
let pendingToken: string | null = null

export const pendingJoin = {
  set: (token: string) => {
    pendingToken = token
  },
  take: () => {
    const token = pendingToken
    pendingToken = null
    return token
  },
}
