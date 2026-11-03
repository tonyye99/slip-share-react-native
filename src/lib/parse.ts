import { FunctionsHttpError } from '@supabase/supabase-js'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'

import { strings } from '@/i18n/strings'
import { supabase } from '@/lib/supabase'
import type { ParsedReceipt } from '@/lib/types'

const MAX_WIDTH = 1600

export async function prepareImage(uri: string, width: number): Promise<string> {
  const context = ImageManipulator.manipulate(uri)
  if (width > MAX_WIDTH) context.resize({ width: MAX_WIDTH })
  const image = await context.renderAsync()
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true })
  if (!result.base64) throw new Error('Could not read the image')
  return result.base64
}

export type ScanLimit = 'daily' | 'monthly' | 'busy'

export class ScanLimitError extends Error {
  constructor(readonly limit: ScanLimit) {
    super(scanLimitMessage(limit))
  }
}

export function scanLimitMessage(limit: ScanLimit): string {
  const t = strings().scan
  if (limit === 'monthly') return t.scanLimitMonth
  if (limit === 'busy') return t.scanLimitBusy
  return t.scanLimit
}

async function limitFrom(response: Response): Promise<ScanLimit> {
  const body: unknown = await response.json().catch(() => null)
  const limit = body && typeof body === 'object' && 'limit' in body ? body.limit : null
  return limit === 'monthly' || limit === 'busy' ? limit : 'daily'
}

export class ConsentRequiredError extends Error {
  constructor() {
    super(strings().scan.consentRequired)
  }
}

export async function parseReceipt(
  imageBase64: string,
  enableTranslation: boolean,
  signal?: AbortSignal,
): Promise<ParsedReceipt> {
  const { data, error } = await supabase.functions.invoke<ParsedReceipt>('parse-receipt', {
    body: { imageBase64, enableTranslation },
    signal,
  })
  if (error instanceof FunctionsHttpError && error.context.status === 429) {
    throw new ScanLimitError(await limitFrom(error.context))
  }
  if (error instanceof FunctionsHttpError && error.context.status === 403) throw new ConsentRequiredError()
  if (error) throw error
  if (!data) throw new Error('No response from parser')
  return data
}
