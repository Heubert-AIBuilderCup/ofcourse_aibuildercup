// The emotion chips (criterion 100, ADR-129): six in one repo file, parsed at load as tags/index.ts
// does. The editor picks one or types their own word. A drafts record and each revision store the
// choice as a string (a chip's id, or the word itself); `emotionOf` is the one way to read it back.
// Client-safe: JSON and zod only.

import { z } from 'zod'
import { charCount } from '../text/script'
import emotions from './emotions.json'

const EmotionSchema = z.object({
  id: z.string().regex(/^[a-z]+$/),
  label: z.string().min(1),
  /** One line the draft prompt follows for tone. */
  tone: z.string().min(1),
})

export type Emotion = z.infer<typeof EmotionSchema>

export const EMOTIONS: readonly Emotion[] = z
  .array(EmotionSchema)
  .refine((all) => new Set(all.map((e) => e.id)).size === all.length, {
    message: 'emotion ids must be unique',
  })
  .parse(emotions)

/**
 * The editor's own word: up to 30 characters as a reader sees them, letters, spaces and hyphens
 * only. A letter is any script's, with its marks: Devanagari and Thai write vowels as marks.
 */
export const EMOTION_MAX = 30
const CUSTOM_WORD = /^\p{L}[\p{L}\p{M}]*(?:[ -]\p{L}[\p{L}\p{M}]*)*$/u
export const EMOTION_ERROR = 'An emotion is a word or two: letters only, up to 30 characters.'

export function emotionById(id: string): Emotion | null {
  return EMOTIONS.find((e) => e.id === id) ?? null
}

/** Null when the value may be stored: a chip's id, or a word within the custom rule. */
export function emotionError(value: string): string | null {
  if (emotionById(value)) return null
  if (charCount(value) > EMOTION_MAX || !CUSTOM_WORD.test(value)) {
    return EMOTION_ERROR
  }
  return null
}

/**
 * The emotion a record stores: a chip by id, the editor's own word as an emotion of its own, and
 * null for none or anything outside the rule. Undefined is none, for rows written before emotions.
 */
export function emotionOf(stored: string | null | undefined): Emotion | null {
  if (stored === null || stored === undefined) return null
  const chip = emotionById(stored)
  if (chip) return chip
  if (emotionError(stored)) return null
  return { id: stored, label: stored, tone: `Write in a ${stored.toLowerCase()} tone throughout.` }
}
