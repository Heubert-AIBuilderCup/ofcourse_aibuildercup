// The nudge chips (GD10, GD13): six that steer the wording of a version or one slide, six that
// steer an image, in one repo file parsed at load as emotions/index.ts does. A chip is pressed by
// id; its instruction is what the model reads, its label what the editor and the history read.
// Client-safe: JSON and zod only.

import { z } from 'zod'
import nudges from './nudges.json'

const NudgeSchema = z.object({
  id: z.string().regex(/^[a-z]+(?:-[a-z]+)*$/),
  label: z.string().min(1),
  /** One line the model follows for the direction. */
  instruction: z.string().min(1),
})

export type Nudge = z.infer<typeof NudgeSchema>

const NudgesSchema = z.object({ text: z.array(NudgeSchema), image: z.array(NudgeSchema) }).refine(
  ({ text, image }) => {
    const ids = [...text, ...image].map((n) => n.id)
    return new Set(ids).size === ids.length
  },
  { message: 'nudge ids must be unique' },
)

/** The nudge file's shape, ids unique across both lists; throws on anything else. */
export function parseNudges(raw: unknown): z.infer<typeof NudgesSchema> {
  return NudgesSchema.parse(raw)
}

const parsed = parseNudges(nudges)

export const TEXT_NUDGES: readonly Nudge[] = parsed.text
export const IMAGE_NUDGES: readonly Nudge[] = parsed.image

export function textNudge(id: string): Nudge | null {
  return TEXT_NUDGES.find((n) => n.id === id) ?? null
}

export function imageNudge(id: string): Nudge | null {
  return IMAGE_NUDGES.find((n) => n.id === id) ?? null
}
