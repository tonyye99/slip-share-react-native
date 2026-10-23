import { Alert, Platform } from 'react-native'

import { strings } from '@/i18n/strings'

// React Native Web's Alert does nothing, so the website uses the browser's own dialogs.

export function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`)
  else Alert.alert(title, message)
}

/** Asks first; `onConfirm` runs only if the person agrees. */
export function confirmAction(
  title: string,
  message: string,
  confirmText: string,
  onConfirm: () => void,
  style: 'default' | 'destructive' = 'default',
) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm()
    return
  }
  Alert.alert(title, message, [
    { text: strings().common.cancel, style: 'cancel' },
    { text: confirmText, style, onPress: onConfirm },
  ])
}

/** Asks before a destructive action; `onConfirm` runs only if the person agrees. */
export function confirmDestructive(title: string, message: string, confirmText: string, onConfirm: () => void) {
  confirmAction(title, message, confirmText, onConfirm, 'destructive')
}
