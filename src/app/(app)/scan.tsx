import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { CameraIcon, GearIcon, ImageIcon, ScanIcon } from '@/components/icons'
import { ReadingReceipt } from '@/components/reading-receipt'
import { ScreenHeader } from '@/components/screen-header'
import { AppText, Button, Card, TextLink } from '@/components/ui'
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { getAiConsent, giveAiConsent, openPrivacyPolicy } from '@/lib/consent'
import { receiptDraft } from '@/lib/draft'
import { ConsentRequiredError, parseReceipt, prepareImage, ScanLimitError } from '@/lib/parse'
import { pickedPhoto, pickPhoto } from '@/lib/photo'
import { checkScan } from '@/lib/split'
import type { ParsedReceipt } from '@/lib/types'

export default function ScanScreen() {
  const theme = useTheme()
  const t = useT()
  const { session } = useAuth()
  // Photos go to OpenAI, so the user agrees once before the first scan.
  const [consent, setConsent] = useState<'checking' | 'needed' | 'given'>('checking')
  const [allowing, setAllowing] = useState(false)
  // A photo taken from the home screen arrives already picked.
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(() => pickedPhoto.take())
  const [translateToEnglish, setTranslateToEnglish] = useState(false)
  // Set while a receipt is being read; the reading screen shows instead.
  const [reading, setReading] = useState<{ stage: 'preparing' | 'reading'; receipt: ParsedReceipt | null } | null>(null)
  const attempt = useRef<AbortController | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Leaving the screen stops a read that is still going.
  useEffect(() => {
    const current = attempt
    return () => current.current?.abort()
  }, [])

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
      setError(t.scan.saveChoiceFailed)
    } finally {
      setAllowing(false)
    }
  }

  const pickImage = async (source: 'camera' | 'library') => {
    setError(null)
    const photo = await pickPhoto(source)
    if (photo) setAsset(photo)
  }

  const readReceipt = async () => {
    if (!asset) return
    const controller = new AbortController()
    attempt.current = controller
    setError(null)
    setReading({ stage: 'preparing', receipt: null })
    try {
      const imageBase64 = await prepareImage(asset.uri, asset.width)
      if (controller.signal.aborted) return
      setReading({ stage: 'reading', receipt: null })
      const parsed = await parseReceipt(imageBase64, translateToEnglish, controller.signal)
      if (controller.signal.aborted) return
      if (!parsed.is_receipt) {
        setReading(null)
        setError(t.scan.notAReceipt)
        return
      }
      setReading({ stage: 'reading', receipt: checkScan(parsed) })
    } catch (e) {
      if (controller.signal.aborted) return
      setReading(null)
      // Turned off on another device since this screen opened.
      if (e instanceof ConsentRequiredError) {
        setConsent('needed')
        return
      }
      console.error('Parse failed', e)
      setError(e instanceof ScanLimitError ? t.scan.scanLimit : t.scan.readFailed)
    }
  }

  // Back to the photo, which stays picked.
  const cancelReading = () => {
    attempt.current?.abort()
    setReading(null)
  }

  const showReview = (receipt: ParsedReceipt) => {
    receiptDraft.set(receipt)
    router.replace('/review')
  }

  if (consent === 'checking') {
    return (
      <View style={[styles.flex, { backgroundColor: theme.background }]}>
        <ScreenHeader title={t.screens.scan} />
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      </View>
    )
  }

  if (consent === 'needed') {
    return (
      <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <ScreenHeader title={t.screens.scan} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <Card>
          <AppText variant="overline">{t.scan.onceOnly}</AppText>
          <AppText variant="title">{t.scan.beforeYouScan}</AppText>
          <AppText>{t.scan.consentIntro}</AppText>
          <View style={styles.points}>
            {t.scan.consentPoints.map((point) => (
              <AppText key={point} variant="muted">
                • {point}
              </AppText>
            ))}
          </View>
          <TextLink title={t.scan.readPolicy} onPress={openPrivacyPolicy} />
        </Card>

        {error && <AppText variant="error">{error}</AppText>}

        <Button title={t.scan.allowAndContinue} onPress={allowScanning} loading={allowing} />
        <Button title={t.scan.notNow} variant="secondary" onPress={() => router.back()} disabled={allowing} />
      </ScrollView>
      </View>
    )
  }

  if (reading && asset) {
    return (
      <ReadingReceipt
        photoUri={asset.uri}
        stage={reading.stage}
        receipt={reading.receipt}
        onCancel={cancelReading}
        onDone={showReview}
      />
    )
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title={asset ? t.scan.checkPhoto : t.screens.scan}
        right={
          <Pressable
            onPress={() => router.push('/account')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t.scan.accountAndSettings}>
            <GearIcon color={theme.text} background={theme.surface} />
          </Pressable>
        }
      />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        {asset ? (
          <View style={[styles.photo, { backgroundColor: theme.backgroundElement }]}>
            <Image
              source={{ uri: asset.uri }}
              style={[styles.photoImage, { aspectRatio: Math.max(asset.width / asset.height, 0.5) }]}
              contentFit="contain"
              accessibilityLabel={t.scan.yourPhoto}
            />
            <View style={styles.photoButtons}>
              <PhotoButton title={t.scan.retake} icon={<CameraIcon color="#FFFFFF" />} onPress={() => pickImage('camera')} />
              <PhotoButton title={t.scan.library} icon={<ImageIcon color="#FFFFFF" />} onPress={() => pickImage('library')} />
            </View>
          </View>
        ) : (
          <Card dashed style={styles.placeholder}>
            <View style={[styles.placeholderIcon, { backgroundColor: theme.primarySoft }]}>
              <CameraIcon color={theme.primary} size={28} />
            </View>
            <AppText variant="title" style={styles.center}>
              {t.scan.takePhoto}
            </AppText>
            <AppText variant="muted" style={styles.center}>
              {t.scan.keepInFrame}
            </AppText>
            <View style={styles.buttons}>
              <Button
                title={t.scan.camera}
                icon={<CameraIcon color={theme.onPrimary} />}
                onPress={() => pickImage('camera')}
                style={styles.flex}
              />
              <Button
                title={t.scan.library}
                variant="secondary"
                icon={<ImageIcon color={theme.text} />}
                onPress={() => pickImage('library')}
                style={styles.flex}
              />
            </View>
          </Card>
        )}

        {asset && (
          <View style={styles.tips}>
            <AppText variant="heading">{t.scan.readEveryLine}</AppText>
            <View style={styles.tipList}>
              {t.scan.tips.map((tip) => (
                <View key={tip} style={styles.tip}>
                  <AppText variant="label" style={{ color: theme.success }}>
                    ✓
                  </AppText>
                  <AppText variant="muted">{tip}</AppText>
                </View>
              ))}
            </View>
          </View>
        )}

        <Card style={styles.toggle}>
          <View style={[styles.aa, { backgroundColor: theme.primarySoft }]}>
            <AppText variant="label" style={{ color: theme.primary }}>
              Aa
            </AppText>
          </View>
          <View style={styles.flex}>
            <AppText variant="heading">{t.scan.englishNames}</AppText>
            <AppText variant="muted">{t.scan.englishNamesHint}</AppText>
          </View>
          <Switch
            value={translateToEnglish}
            onValueChange={setTranslateToEnglish}
            trackColor={{ true: theme.primary }}
            accessibilityLabel={t.scan.englishNames}
          />
        </Card>

        {error && <AppText variant="error">{error}</AppText>}
      </ScrollView>

      {asset && (
        <SafeAreaView edges={['bottom']} style={[styles.footerBar, { backgroundColor: theme.surface, borderColor: theme.hairline }]}>
          <View style={styles.footer}>
            <Button title={t.scan.readReceipt} icon={<ScanIcon color={theme.onPrimary} />} onPress={readReceipt} />
          </View>
        </SafeAreaView>
      )}
    </View>
  )
}

/** A dark see-through button laid over the photo. */
function PhotoButton({ title, icon, onPress }: { title: string; icon: ReactNode; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.photoButton, { opacity: pressed ? 0.8 : 1 }]}>
      {icon}
      <Text style={styles.photoButtonText}>{title}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  points: { gap: Spacing.one },
  center: { textAlign: 'center' },
  photo: { borderRadius: Radius.large, overflow: 'hidden' },
  photoImage: { width: '100%', maxHeight: 520 },
  photoButtons: {
    position: 'absolute',
    left: Spacing.three - 4,
    right: Spacing.three - 4,
    bottom: Spacing.three - 4,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 44,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(16, 24, 27, 0.72)',
  },
  photoButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  placeholder: { alignItems: 'center', gap: Spacing.three - 4, paddingVertical: Spacing.five },
  placeholderIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  buttons: { flexDirection: 'row', gap: Spacing.two, alignSelf: 'stretch', marginTop: Spacing.two },
  tips: { gap: Spacing.one + 2 },
  tipList: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.three, rowGap: Spacing.one },
  tip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4 },
  aa: { width: 44, height: 44, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center' },
  footerBar: { borderTopWidth: StyleSheet.hairlineWidth },
  footer: { padding: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
})
