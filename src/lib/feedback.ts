import * as Application from 'expo-application'
import * as Device from 'expo-device'
import { Linking, Platform } from 'react-native'

import { strings } from '@/i18n/strings'
import { showAlert } from '@/lib/alert'

export const FEEDBACK_EMAIL = 'tony.yehtetaung@gmail.com'

function aboutThisDevice(): string {
  const version = Application.nativeApplicationVersion
  const build = Application.nativeBuildVersion
  const device =
    Platform.OS === 'web' ? 'Website' : [Device.modelName, Device.osName, Device.osVersion].filter(Boolean).join(' ')
  return [`SlipShare ${version ?? ''}${build ? ` (${build})` : ''}`.trim(), device].filter(Boolean).join(' · ')
}

export async function sendFeedback() {
  const t = strings().feedback
  const subject = encodeURIComponent(t.subject)
  const body = encodeURIComponent(`${t.body}\n\n\n--\n${aboutThisDevice()}`)
  try {
    await Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`)
  } catch (e) {
    console.warn('No mail app', e)
    showAlert(t.noMailApp, t.writeTo(FEEDBACK_EMAIL))
  }
}
