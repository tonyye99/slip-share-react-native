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

export async function parseReceipt(imageBase64: string, enableTranslation: boolean): Promise<ParsedReceipt> {
  const { data, error } = await supabase.functions.invoke<ParsedReceipt>('parse-receipt', {
    body: { imageBase64, enableTranslation },
  })
  if (error) throw error
  if (!data) throw new Error('No response from parser')
  return data
}
