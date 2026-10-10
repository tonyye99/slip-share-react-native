import { Alert, Platform } from 'react-native'

// React Native Web's Alert does nothing, so the website uses the browser's own dialogs.

export function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`)
  else Alert.alert(title, message)
}

/** Asks before a destructive action; `onConfirm` runs only if the person agrees. */
export function confirmDestructive(title: string, message: string, confirmText: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm()
    return
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmText, style: 'destructive', onPress: onConfirm },
  ])
}
