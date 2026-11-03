import { FunctionsHttpError } from '@supabase/supabase-js'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import type { ImagePickerAsset } from 'expo-image-picker'

import type { LinkIdentity } from '@/lib/link-picks'
import { supabase } from '@/lib/supabase'

const BUCKET = 'slips'

const MAX_WIDTH = 1080
const MAX_HEIGHT = 2400
const MAX_BASE64_LENGTH = 2_700_000

export class SlipError extends Error {
  constructor(readonly status: number) {
    super(`upload-slip returned ${status}`)
  }
}

export async function prepareSlip(asset: Pick<ImagePickerAsset, 'uri' | 'width' | 'height'>): Promise<string> {
  const scale = Math.min(1, MAX_WIDTH / (asset.width || MAX_WIDTH), MAX_HEIGHT / (asset.height || MAX_HEIGHT))
  const context = ImageManipulator.manipulate(asset.uri)
  if (scale < 1) context.resize({ width: Math.round(asset.width * scale) })
  const image = await context.renderAsync()
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true })
  if (!result.base64) throw new Error('Could not read the image')
  if (result.base64.length > MAX_BASE64_LENGTH) throw new SlipError(413)
  return result.base64
}

export async function sendSlip(token: string, identity: LinkIdentity, imageBase64: string | null) {
  const { error } = await supabase.functions.invoke('upload-slip', {
    body: { token, person_id: identity.person_id, guest_key: identity.guest_key, image_base64: imageBase64 },
  })
  if (error instanceof FunctionsHttpError) throw new SlipError(error.context.status)
  if (error) throw error
}

export async function slipUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

export async function removeSlipFiles(receiptId: string, personId?: string) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(receiptId, { limit: 1000, ...(personId ? { search: personId } : {}) })
  if (error) {
    if (/bucket not found/i.test(error.message)) return
    throw error
  }
  const names = data
    .filter((file) => file.id && (!personId || file.name.startsWith(`${personId}-`)))
    .map((file) => `${receiptId}/${file.name}`)
  if (names.length === 0) return
  const { error: removeError } = await supabase.storage.from(BUCKET).remove(names)
  if (removeError) throw removeError
}
