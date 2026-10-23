import * as ImagePicker from 'expo-image-picker'

import { strings } from '@/i18n/strings'
import { showAlert } from '@/lib/alert'

/** Takes a photo or picks one from the library. Null when the person cancels or says no to the camera. */
export async function pickPhoto(source: 'camera' | 'library'): Promise<ImagePicker.ImagePickerAsset | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      showAlert(strings().common.cameraNeeded, strings().common.cameraNeededMessage)
      return null
    }
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 1 }
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options)
  return result.canceled ? null : result.assets[0]
}

// Hands a photo picked on the home screen to the scan screen; a photo is too
// large to pass as a route param.
let picked: ImagePicker.ImagePickerAsset | null = null

export const pickedPhoto = {
  set: (asset: ImagePicker.ImagePickerAsset) => {
    picked = asset
  },
  /** The photo, once; the next call returns null. */
  take: () => {
    const asset = picked
    picked = null
    return asset
  },
}
