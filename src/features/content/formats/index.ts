// The formats a post can take (GD33): ten in one repo file, parsed at load as emotions/index.ts
// does, each with a one-line description the idea cards show and the slide jobs it starts from.
// The ideas call ranks them for a source; its top three are shown first, marked "Recommended".
// Client-safe: JSON and zod only.

import { z } from 'zod'
import { FORMAT_IDS, type FormatId, OUTLINE_JOBS } from '../model/types'
import formats from './formats.json'

const FormatSchema = z.object({
  id: z.enum(FORMAT_IDS),
  label: z.string().min(1),
  /** One line the idea cards and the outline show, and the model reads. */
  description: z.string().min(1),
  /** The slide jobs the format starts from, first to last. */
  jobs: z.array(z.enum(OUTLINE_JOBS)).min(3),
})

export type Format = z.infer<typeof FormatSchema>

/** The format file's shape: each of the ten ids once, in FORMAT_IDS order; throws on anything else. */
export function parseFormats(raw: unknown): Format[] {
  return z
    .array(FormatSchema)
    .refine((all) => all.map((f) => f.id).join() === FORMAT_IDS.join(), {
      message: 'the format file lists each format id once, in order',
    })
    .parse(raw)
}

export const FORMATS: readonly Format[] = parseFormats(formats)

export function formatById(id: string): Format | null {
  return FORMATS.find((f) => f.id === id) ?? null
}

/** How many of the model's ranked formats are shown first and marked "Recommended" (GD33). */
export const RECOMMENDED_FORMATS = 3

/**
 * Every format, the model's top three first and marked recommended, then the rest in the file's
 * order. Ideas found before formats were ranked have none: the file's order, none marked.
 */
export function rankedFormats(
  top: readonly FormatId[] | undefined,
): { format: Format; recommended: boolean }[] {
  const first = (top ?? []).slice(0, RECOMMENDED_FORMATS)
  return [
    ...first.flatMap((id) => {
      const format = formatById(id)
      return format ? [{ format, recommended: true }] : []
    }),
    ...FORMATS.filter((f) => !first.includes(f.id)).map((format) => ({
      format,
      recommended: false,
    })),
  ]
}
