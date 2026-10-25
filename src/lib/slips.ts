import { FunctionsHttpError } from '@supabase/supabase-js'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import type { ImagePickerAsset } from 'expo-image-picker'

import type { LinkIdentity } from '@/lib/link-picks'
import { supabase } from '@/lib/supabase'

// Transfer slips: a friend on the friend link adds a screenshot of the
// transfer they made, and the bill's owner sees it on that person's card.
// Photos live in the private "slips" bucket, one folder per bill. Friends send
// them through the upload-slip Edge Function; only the owner can read them
// (supabase/migrations/*_payment_slips.sql).

const BUCKET = 'slips'

// Slips are tall phone screenshots; this keeps the text sharp and the file small.
const MAX_WIDTH = 1080
const MAX_HEIGHT = 2400
// upload-slip turns away anything over 2 MB.
const MAX_BASE64_LENGTH = 2_700_000

/** The upload-slip function said no; `status` says why. */
export class SlipError extends Error {
  constructor(readonly status: number) {
    super(`upload-slip returned ${status}`)
  }
}

/** Shrinks a picked photo to a JPEG for upload-slip. */
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

/** Sends your slip for the bill on this link, or removes it (null). */
export async function sendSlip(token: string, identity: LinkIdentity, imageBase64: string | null) {
  const { error } = await supabase.functions.invoke('upload-slip', {
    body: { token, person_id: identity.person_id, guest_key: identity.guest_key, image_base64: imageBase64 },
  })
  if (error instanceof FunctionsHttpError) throw new SlipError(error.context.status)
  if (error) throw error
}

/** A link to look at a slip for the next hour. Only the bill's owner can get one. */
export async function slipUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

/**
 * Removes the slips on a bill, or only one person's. Storage files don't go
 * with the database rows, so this runs before deleting the bill or person.
 */
export async function removeSlipFiles(receiptId: string, personId?: string) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(receiptId, { limit: 1000, ...(personId ? { search: personId } : {}) })
  if (error) {
    // Until the payment_slips migration runs there is no bucket, and no slips.
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
