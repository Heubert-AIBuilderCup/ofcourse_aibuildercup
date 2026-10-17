import 'server-only'
// Why a tile is on her road (criteria 15, 17, 18, 20): the model words it from her answers, her
// tags and the catalogue's facts, and code checks every word (whyProblems); anything else gives
// the template. The cache answers the same answers and tile again with no new call. Only her own
// roadmap is read, and nothing is written for a tile her answers did not decide.

import { ai } from '@/features/content/ai/client'
import { STUDENT_WHY } from '@/features/content/ai/prompts'
// For its side effect: a roadmap pinned to a finder course draws its road.
import '@/features/finder/server/road-courses'
import { getRoadmap } from '@/features/roadmaps/server/roadmaps'
import { slotOf } from '../model/build'
import { roadFor } from '../model/road-for'
import { isWhySlot, pinnedMatch, whyFacts, whyProblems, whyTemplate } from '../model/why'
import { studentAiOff } from '../switch'

/** One model attempt; the client may try again, on a higher tier. */
const WHY_TIMEOUT_MS = 8000
/** The whole why, every attempt included: past it the template stays (criterion 80). */
const WHY_DEADLINE_MS = 10000

export type Why = { text: string; source: 'model' | 'template' }

/**
 * The why for a tile on her roadmap's road; null when it is not hers, not a why tile, or switched
 * off. With `model` false (she is over her limit) or the student AI off it is the template, and
 * the model is not called. Past `deadlineMs` it is the template too: a late answer is not read.
 */
export async function writeWhy(
  userId: string,
  roadmapId: string,
  tileId: string,
  env: Record<string, string | undefined> = process.env,
  model = true,
  deadlineMs = WHY_DEADLINE_MS,
): Promise<Why | null> {
  const roadmap = await getRoadmap(userId, roadmapId)
  if (!roadmap) return null
  const { spec, match, kind } = roadFor(
    { answers: roadmap.answers, relative: roadmap.relative, pinned: roadmap.choices.pinned },
    env,
  )
  if (!spec || !match) return null
  const slot = slotOf(spec, tileId)
  if (!isWhySlot(slot)) return null
  // The rules that chose her road, so the why names them (criterion 64); on a pinned road, that she
  // chose its course, and never the rules of the road her answers matched.
  const chosen =
    kind === 'pinned'
      ? pinnedMatch(spec, roadmap.answers)
      : { differences: match.differences, relative: roadmap.relative }
  const template = (): Why => ({
    text: whyTemplate(spec, slot, roadmap.answers, chosen),
    source: 'template',
  })

  if (!model || studentAiOff(env)) return template()
  const data = whyFacts(spec, slot, roadmap.answers, roadmap.tags, chosen)
  let timer: ReturnType<typeof setTimeout> | undefined
  // The deadline also stops the client: no rung starts once the template is shown.
  const deadline = new AbortController()
  const res = await Promise.race([
    ai.generateJson(STUDENT_WHY, {
      data,
      verify: (v) => whyProblems(v.why, data, v.used),
      timeoutMs: WHY_TIMEOUT_MS,
      signal: deadline.signal,
    }),
    new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        deadline.abort()
        resolve(null)
      }, deadlineMs)
    }),
  ])
  clearTimeout(timer)
  if (res?.ok) return { text: res.value.why.trim(), source: 'model' }
  return template()
}
