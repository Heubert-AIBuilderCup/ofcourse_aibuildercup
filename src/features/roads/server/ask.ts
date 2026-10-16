import 'server-only'
// Ask about a tile (criteria 23–28): the model answers her typed question from the tile's rows
// and her answers only, and code checks every answer (askProblems); an answer that never passes
// is the no-data refusal. Only her own roadmap is read, her question takes one of today's slots
// before any call (reserveAsk, under a lock, so questions sent at once cannot pass the cap), and
// every question that reaches the model is logged for Insights. generateJson only: her text never
// goes to a web search.

import { ai } from '@/features/content/ai/client'
import { STUDENT_ASK } from '@/features/content/ai/prompts'
import { getRoadmap } from '@/features/roadmaps/server/roadmaps'
import { askCap, askFacts, askProblems, isAskSlot } from '../model/ask'
import {
  ASK_CAPPED,
  ASK_FAILED,
  ASK_QUESTION_MAX,
  type AskReply,
  NO_DATA,
  needsCounsellor,
} from '../model/ask-words'
import { slotOf } from '../model/build'
import { roadFor } from '../model/road-for'
import { studentAiOff } from '../switch'
import { reserveAsk, settleAsk } from './asks'

/** One model attempt; the client may try again. */
const ASK_TIMEOUT_MS = 12000
/** The whole answer, every attempt included: past it she is told it could not answer (criterion 80). */
const ASK_DEADLINE_MS = 12000

/**
 * Her question answered from one tile on her roadmap's road; null when it is not hers, not an Ask
 * tile, not a question, or switched off (the student side, or the student AI: then nothing is
 * reserved or called). Past `deadlineMs` it is the failure, settled once; a late answer is not read.
 */
export async function askTile(
  userId: string,
  roadmapId: string,
  tileId: string,
  question: string,
  env: Record<string, string | undefined> = process.env,
  deadlineMs = ASK_DEADLINE_MS,
): Promise<AskReply | null> {
  if (studentAiOff(env)) return null
  const asked = question.trim()
  if (asked === '' || asked.length > ASK_QUESTION_MAX) return null
  const roadmap = await getRoadmap(userId, roadmapId)
  if (!roadmap) return null
  const { spec } = roadFor({ answers: roadmap.answers, relative: roadmap.relative }, env)
  if (!spec) return null
  const slot = slotOf(spec, tileId)
  if (!isAskSlot(slot)) return null

  const askId = await reserveAsk({ userId, roadmapId, tileId, question: asked }, askCap(env))
  if (!askId) return { kind: 'capped', reply: ASK_CAPPED, cited: [] }

  const facts = askFacts(spec, slot, roadmap.answers, roadmap.tags)
  // An answer that came back and failed the checks is a refusal; no answer at all is a failure.
  let checked = false
  let timer: ReturnType<typeof setTimeout> | undefined
  // The deadline also stops the client: no rung starts once she has been told it failed.
  const deadline = new AbortController()
  const res = await Promise.race([
    ai.generateJson(STUDENT_ASK, {
      data: { ...facts, question: asked },
      verify: (v) => {
        checked = true
        return askProblems(v, facts)
      },
      timeoutMs: ASK_TIMEOUT_MS,
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

  let reply: AskReply & { kind: Exclude<AskReply['kind'], 'capped'> }
  if (res === null) {
    reply = { kind: 'failed', reply: ASK_FAILED, cited: [] }
  } else if (res.ok && res.value.answerable) {
    const cited = new Set(res.value.cited)
    reply = {
      kind: 'answered',
      reply: res.value.reply.trim(),
      cited: facts.rows.filter((r) => cited.has(r.id)),
    }
  } else if (res.ok || checked) {
    reply = { kind: 'refused', reply: NO_DATA, cited: [], counsellor: needsCounsellor(asked) }
  } else {
    reply = { kind: 'failed', reply: ASK_FAILED, cited: [] }
  }
  await settleAsk(askId, { reply: reply.reply, outcome: reply.kind })
  return reply
}
