import { FunctionsHttpError } from '@supabase/supabase-js'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'

import { supabase } from '@/lib/supabase'
import type { ParsedReceipt } from '@/lib/types'

// Phone photos are often 4000px+ and several MB; 1600px wide keeps receipt
// text legible for the model while keeping the upload small.
const MAX_WIDTH = 1600

export async function prepareImage(uri: string, width: number): Promise<string> {
  const context = ImageManipulator.manipulate(uri)
  if (width > MAX_WIDTH) context.resize({ width: MAX_WIDTH })
  const image = await context.renderAsync()
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true })
  if (!result.base64) throw new Error('Could not read the image')
  return result.base64
}

/** The parse-receipt function allows a limited number of scans per user per day. */
export class ScanLimitError extends Error {
  constructor() {
    super("You've reached today's scan limit. Try again tomorrow.")
  }
}

/** parse-receipt won't send a photo to OpenAI until the user has agreed (see lib/consent). */
export class ConsentRequiredError extends Error {
  constructor() {
    super('Allow receipt scanning to read this receipt.')
  }
}

export async function parseReceipt(imageBase64: string, enableTranslation: boolean): Promise<ParsedReceipt> {
  const { data, error } = await supabase.functions.invoke<ParsedReceipt>('parse-receipt', {
    body: { imageBase64, enableTranslation },
  })
  if (error instanceof FunctionsHttpError && error.context.status === 429) throw new ScanLimitError()
  if (error instanceof FunctionsHttpError && error.context.status === 403) throw new ConsentRequiredError()
  if (error) throw error
  if (!data) throw new Error('No response from parser')
  return data
}
