import 'server-only'

// The art check (criterion 103). Each generated cover image is read by a model on its own, before
// anything is drawn on it: is there any text, letter, number, logo or watermark in it? Code draws
// every word a slide carries, so the slides themselves are never read back.

import { ai } from './client'
import { ART_CHECK } from './prompts'

/** 'failed': the check could not read the art, so it is never offered as if it were clean. */
export type ArtVerdict = 'clean' | 'text' | 'failed'

/** The art alone, as the image model drew it (a PNG), with no other data for the model to read. */
export async function artCheck(input: { bytes: Uint8Array; postId: string }): Promise<ArtVerdict> {
  const res = await ai.generateJson(ART_CHECK, {
    data: {},
    images: [{ mime: 'image/png', base64: Buffer.from(input.bytes).toString('base64') }],
    postId: input.postId,
  })
  if (!res.ok) return 'failed'
  return res.value.has_text ? 'text' : 'clean'
}
