import 'server-only'
// Her own words on a question step (criteria 36, 37, 40, 42): kept on the roadmap she is
// answering, then read by the model against the step's questions, and checked in code
// (checkOwnWords) before anything comes back. A failed or slow reading still offers the amount
// and start code reads alone; one with nothing to offer says so, and her words stay. Only her own
// draft is read and written; her text goes to the model, never a search.

import { ai } from '@/features/content/ai/client'
import { STUDENT_WORDS } from '@/features/content/ai/prompts'
import { addTags, saveOwnWords } from '@/features/roadmaps/server/roadmaps'
import { OWN_WORDS_MAX, type OwnWordsStep, type RoadmapTag } from '@/shared/types/student'
import {
  checkOwnWords,
  type OwnWordsChip,
  type OwnWordsModel,
  ownWordsQuestions,
} from '../model/own-words'
import { effective } from '../model/questions'

/** One model attempt; the client may try again, on a higher tier. */
const OWN_WORDS_TIMEOUT_MS = 12000
/** The whole reading, every attempt included: past it the taps carry on. */
const OWN_WORDS_DEADLINE_MS = 15000

export type OwnWordsReading = { chips: OwnWordsChip[]; tags: RoadmapTag[]; failed: boolean }

const NOTHING: OwnWordsReading = { chips: [], tags: [], failed: true }
/** No answer from the model: only what code reads from her words is offered. */
const NO_MODEL: OwnWordsModel = { chips: [], tags: [] }

/**
 * Keeps her words on the step, then reads them. Null when there is nothing to read (empty once
 * trimmed, over OWN_WORDS_MAX) or no roadmap being answered: nothing is written or sent then.
 * Past `deadlineMs` it gives up (criterion 42): the model may still answer, unread and unstored.
 * With `model` false (she is over her limit) her words are kept and the reading is `failed`, with
 * no model call. Never cached: nothing she wrote is kept outside her roadmap.
 */
export async function readOwnWords(
  userId: string,
  step: OwnWordsStep,
  text: string,
  model = true,
  deadlineMs = OWN_WORDS_DEADLINE_MS,
): Promise<OwnWordsReading | null> {
  const words = text.trim()
  if (words === '' || words.length > OWN_WORDS_MAX) return null
  const draft = await saveOwnWords(userId, step, words)
  if (!draft) return null
  if (!model) return NOTHING

  let timer: ReturnType<typeof setTimeout> | undefined
  const res = await Promise.race([
    ai.generateJson(STUDENT_WORDS, {
      data: { text: words, questions: ownWordsQuestions(step) },
      timeoutMs: OWN_WORDS_TIMEOUT_MS,
      cache: false,
    }),
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), deadlineMs)
    }),
  ])
  clearTimeout(timer)
  // Rupees and lakh are read in the currency of where she is (her answer, else its default). A
  // failed or slow reading still offers what code reads alone, her amount and start (criterion 73).
  const where = effective(draft.answers, 'where')
  const read = checkOwnWords(
    step,
    words,
    res?.ok ? res.value : NO_MODEL,
    draft.answers,
    typeof where === 'string' ? where : null,
  )
  if (read.chips.length === 0 && read.tags.length === 0) return NOTHING
  if (res?.ok) await addTags(userId, read.tags)
  return { ...read, failed: false }
}
