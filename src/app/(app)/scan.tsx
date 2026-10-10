import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, View } from 'react-native'

import { AppText, Button, Card, TextLink } from '@/components/ui'
import { MaxContentWidth, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useAuth } from '@/lib/auth'
import { getAiConsent, giveAiConsent, openPrivacyPolicy } from '@/lib/consent'
import { receiptDraft } from '@/lib/draft'
import { ConsentRequiredError, parseReceipt, prepareImage, ScanLimitError } from '@/lib/parse'
import { dropIncludedCharges, receiptSubtotal } from '@/lib/split'

export default function ScanScreen() {
  const theme = useTheme()
  const { session } = useAuth()
  // Photos go to OpenAI, so the user agrees once before the first scan.
  const [consent, setConsent] = useState<'checking' | 'needed' | 'given'>('checking')
  const [allowing, setAllowing] = useState(false)
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [translateToEnglish, setTranslateToEnglish] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAiConsent()
      .then((consentedAt) => setConsent(consentedAt ? 'given' : 'needed'))
      .catch((e) => {
        // Asking again is harmless: agreeing twice keeps the first date.
        console.error('Consent check failed', e)
        setConsent('needed')
      })
  }, [])

  const allowScanning = async () => {
    if (!session) return
    setAllowing(true)
    setError(null)
    try {
      await giveAiConsent(session.user.id)
      setConsent('given')
    } catch (e) {
      console.error('Saving consent failed', e)
      setError('Could not save your choice. Check your connection and try again.')
    } finally {
      setAllowing(false)
    }
  }

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
      receiptDraft.set(dropIncludedCharges(parsed, receiptSubtotal(parsed.items)))
      router.replace('/review')
    } catch (e) {
      // Turned off on another device since this screen opened.
      if (e instanceof ConsentRequiredError) {
        setConsent('needed')
        return
      }
      console.error('Parse failed', e)
      setError(
        e instanceof ScanLimitError ? e.message : 'Could not read the receipt. Check your connection and try again.',
      )
    } finally {
      setParsing(false)
    }
  }

  if (consent === 'checking') {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator />
      </View>
    )
  }

  if (consent === 'needed') {
    return (
      <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
        <Card>
          <AppText variant="heading">Before you scan</AppText>
          <AppText>
            SlipShare uses OpenAI to read receipts. When you tap Read receipt, your photo is sent to OpenAI to pick out
            the shop name, items and prices.
          </AppText>
          <View style={styles.points}>
            <AppText variant="muted">• SlipShare doesn&apos;t keep the photo, only the items you save.</AppText>
            <AppText variant="muted">
              • OpenAI doesn&apos;t use it to train its models. It may keep it for up to 30 days to check for abuse, then
              deletes it.
            </AppText>
            <AppText variant="muted">• You can turn this off any time in Account.</AppText>
          </View>
          <TextLink title="Read the privacy policy" onPress={openPrivacyPolicy} />
        </Card>

        {error && <AppText variant="error">{error}</AppText>}

        <Button title="Allow and continue" onPress={allowScanning} loading={allowing} />
        <Button title="Not now" variant="secondary" onPress={() => router.back()} disabled={allowing} />
      </ScrollView>
    )
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  points: { gap: Spacing.one },
  center: { textAlign: 'center' },
  preview: { width: '100%', maxHeight: 420, borderRadius: 12 },
  placeholder: { alignItems: 'center', paddingVertical: Spacing.six },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
})
