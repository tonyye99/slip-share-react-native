import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native'

import { SettingsGroup, SettingsRow } from '@/components/account/settings-list'
import { payIcon } from '@/components/pay-icon'
import { ScreenHeader } from '@/components/screen-header'
import { Sheet, SheetOption } from '@/components/sheet'
import { AppText, Button } from '@/components/ui'
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { useT } from '@/i18n'
import { payTitle, paySubtitle, type PayMethodKind } from '@/lib/pay-lines'
import { listPayMethods, MAX_PAY_METHODS, type PayMethod } from '@/lib/pay-methods'

// Account > How to pay me: the ways friends can pay you back, and + Add.
export default function PayMethodsScreen() {
  const theme = useTheme()
  const t = useT()
  const [methods, setMethods] = useState<PayMethod[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [adding, setAdding] = useState(false)

  useFocusEffect(
    useCallback(() => {
      let live = true
      listPayMethods()
        .then((loaded) => {
          if (!live) return
          setMethods(loaded)
          setFailed(false)
        })
        .catch((e) => {
          console.error('Loading ways to get paid failed', e)
          if (live) setFailed(true)
        })
      return () => {
        live = false
      }
    }, []),
  )

  const open = (kind: PayMethodKind, id?: string) =>
    router.push({ pathname: '/pay-method', params: id ? { kind, id } : { kind } })

  const pick = (kind: PayMethodKind) => {
    setAdding(false)
    open(kind)
  }

  const tile = (kind: PayMethodKind, primary: boolean) => (
    <View style={[styles.tile, { backgroundColor: primary ? theme.primarySoft : theme.backgroundElement }]}>
      {payIcon(kind, primary ? theme.primary : theme.textSecondary)}
    </View>
  )

  const full = (methods?.length ?? 0) >= MAX_PAY_METHODS

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <ScreenHeader title={t.pay.title} plain />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <AppText variant="muted" style={styles.intro}>
          {t.pay.intro}
        </AppText>

        {methods === null ? (
          failed ? (
            <AppText variant="error" style={styles.intro}>
              {t.pay.loadFailed}
            </AppText>
          ) : (
            <ActivityIndicator style={styles.loading} />
          )
        ) : (
          <>
            {methods.length > 0 && (
              <SettingsGroup>
                {methods.map((method) => (
                  <SettingsRow
                    key={method.id}
                    tone={method.kind === 'promptpay' ? 'primary' : 'neutral'}
                    icon={(color) => payIcon(method.kind, color)}
                    title={payTitle(method)}
                    badge={method.kind === 'promptpay' ? t.pay.qrWithAmount : undefined}
                    subtitle={paySubtitle(method)}
                    chevron
                    onPress={() => open(method.kind, method.id)}
                  />
                ))}
              </SettingsGroup>
            )}

            {full ? (
              <AppText variant="caption" style={styles.note}>
                {t.pay.tooMany}
              </AppText>
            ) : (
              <Pressable
                onPress={() => setAdding(true)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.add,
                  { borderColor: theme.border, backgroundColor: pressed ? theme.primaryTint : 'transparent' },
                ]}>
                <AppText variant="label" style={{ color: theme.primary }}>
                  + {t.pay.add}
                </AppText>
              </Pressable>
            )}

            {methods.length > 1 && (
              <AppText variant="caption" style={styles.note}>
                {t.pay.order}
              </AppText>
            )}
            <View style={[styles.privacy, { backgroundColor: theme.primaryTint }]}>
              <AppText variant="caption">{t.pay.privacyNote}</AppText>
            </View>
          </>
        )}
      </ScrollView>

      <Sheet visible={adding} onClose={() => setAdding(false)} title={t.pay.add} subtitle={t.pay.addSubtitle}>
        <AppText variant="overline" style={[styles.group, { color: theme.textSecondary }]}>
          {t.pay.qrGroup}
        </AppText>
        <SheetOption
          label={t.pay.promptpay}
          detail={t.pay.promptpayDetail}
          icon={tile('promptpay', true)}
          onPress={() => pick('promptpay')}
        />
        <AppText variant="overline" style={[styles.group, { color: theme.textSecondary }]}>
          {t.pay.otherGroup}
        </AppText>
        <SheetOption label={t.pay.bank} detail={t.pay.bankDetail} icon={tile('bank', false)} onPress={() => pick('bank')} />
        <SheetOption label={t.pay.note} detail={t.pay.noteDetail} icon={tile('note', false)} onPress={() => pick('note')} />
        <Button title={t.common.cancel} variant="secondary" onPress={() => setAdding(false)} style={styles.cancel} />
      </Sheet>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  intro: { marginHorizontal: Spacing.one },
  loading: { marginTop: Spacing.four },
  add: {
    minHeight: 54,
    borderRadius: Radius.large + 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { marginHorizontal: Spacing.one, marginTop: -Spacing.one },
  privacy: { borderRadius: Radius.medium, padding: Spacing.three - 4 },
  tile: { width: 36, height: 36, borderRadius: Radius.medium - 2, alignItems: 'center', justifyContent: 'center' },
  group: { marginTop: Spacing.two, marginLeft: Spacing.two },
  cancel: { marginTop: Spacing.two },
})
