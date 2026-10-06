import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native'

import { AppText, Button, Card } from '@/components/ui'
import { MaxContentWidth, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { receiptDraft } from '@/lib/draft'
import { parseReceipt, prepareImage, ScanLimitError } from '@/lib/parse'

export default function ScanScreen() {
  const theme = useTheme()
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [translateToEnglish, setTranslateToEnglish] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickImage = async (source: 'camera' | 'library') => {
    setError(null)
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('Camera access needed', 'Allow camera access in Settings to scan receipts.')
        return
      }
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 1 }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options)
    if (!result.canceled) setAsset(result.assets[0])
  }

  const readReceipt = async () => {
    if (!asset) return
    setParsing(true)
    setError(null)
    try {
      const imageBase64 = await prepareImage(asset.uri, asset.width)
      const parsed = await parseReceipt(imageBase64, translateToEnglish)
      if (!parsed.is_receipt) {
        setError("This doesn't look like a receipt. Try a clearer photo of the bill.")
        return
      }
      receiptDraft.set(parsed)
      router.replace('/review')
    } catch (e) {
      console.error('Parse failed', e)
      setError(
        e instanceof ScanLimitError ? e.message : 'Could not read the receipt. Check your connection and try again.',
      )
    } finally {
      setParsing(false)
    }
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      {asset ? (
        <Image source={{ uri: asset.uri }} style={[styles.preview, { aspectRatio: asset.width / asset.height }]} contentFit="contain" />
      ) : (
        <Card style={styles.placeholder}>
          <AppText variant="heading">Take a photo of the bill</AppText>
          <AppText variant="muted" style={styles.center}>
            Keep the whole receipt in frame, flat and well lit.
          </AppText>
        </Card>
      )}

      <View style={styles.buttons}>
        <View style={styles.flex}>
          <Button title={asset ? 'Retake' : 'Camera'} variant={asset ? 'secondary' : 'primary'} onPress={() => pickImage('camera')} disabled={parsing} />
        </View>
        <View style={styles.flex}>
          <Button title="Photo library" variant="secondary" onPress={() => pickImage('library')} disabled={parsing} />
        </View>
      </View>

      <Card style={styles.toggle}>
        <View style={styles.flex}>
          <AppText variant="label">Translate to English</AppText>
          <AppText variant="muted">For receipts in other languages.</AppText>
        </View>
        <Switch value={translateToEnglish} onValueChange={setTranslateToEnglish} />
      </Card>

      {error && <AppText variant="error">{error}</AppText>}

      {asset && <Button title={parsing ? 'Reading receipt…' : 'Read receipt'} onPress={readReceipt} loading={parsing} />}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  preview: { width: '100%', maxHeight: 420, borderRadius: 12 },
  placeholder: { alignItems: 'center', paddingVertical: Spacing.six },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
})
