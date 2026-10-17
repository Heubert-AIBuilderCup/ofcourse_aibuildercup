// The real-Gemini check's cases (criteria 76, 77): 2 why, 3 Ask and 3 own words, the one list
// the script (scripts/ai-smoke-student.ts) and the admin's "Test all student calls" run. Each case
// builds its data with the app's own builders, makes one generateJson call with the cache
// bypassed, and judges the reply with the app's own checks. It returns the problems; [] passes.

import type { z } from 'zod'
import type { makeAi } from '@/features/content/ai/client'
import {
  type PromptSpec,
  STUDENT_ASK,
  STUDENT_WHY,
  STUDENT_WORDS,
} from '@/features/content/ai/prompts'
import { checkOwnWords, ownWordsQuestions } from '@/features/opening/model/own-words'
import type { OwnWordsStep, StoredAnswers } from '@/shared/types/student'
import type { RoadSpec } from '../data/types'
import { type AskSlot, askFacts, askProblems } from '../model/ask'
import { NO_DATA } from '../model/ask-words'
import { DEMO_PROFILES } from '../model/demo-profiles'
import { roadFor } from '../model/road-for'
import { type WhyMatch, type WhySlot, whyFacts, whyProblems } from '../model/why'
import { untaggedWellbeing, wellbeingChips } from './score'

/** Pins a spec for the run: the script caps it at Flash-Lite, one attempt per call. */
export type Pin = <S extends z.ZodType>(spec: PromptSpec<S>) => PromptSpec<S>
export type CheckCase = {
  label: string
  /** The problems with the reply; [] passes. */
  run(ai: ReturnType<typeof makeAi>, pin: Pin): Promise<string[]>
}

const PROFILE = DEMO_PROFILES[0]

type Road = { spec: RoadSpec; answers: StoredAnswers; why: WhyMatch }

/** Demo profile 1's road and the rules that chose it, as the board reads them; null when none. */
function profileRoad(answers: StoredAnswers): Road | null {
  const { spec, match } = roadFor({ answers, relative: PROFILE.relative }, {})
  if (!spec || !match) return null
  return { spec, answers, why: { differences: match.differences, relative: PROFILE.relative } }
}

const NO_ROAD = ['No road matched demo profile 1.']

/** The why for one tile, judged by whyProblems. */
function whyCase(label: string, slot: WhySlot): CheckCase {
  return {
    label,
    async run(ai, pin) {
      const road = profileRoad(PROFILE.answers)
      if (!road) return NO_ROAD
      const data = whyFacts(road.spec, slot, road.answers, [], road.why)
      let problems: string[] = []
      const res = await ai.generateJson(pin(STUDENT_WHY), {
        data,
        verify: (v) => {
          problems = whyProblems(v.why, data, v.used)
          return problems
        },
        cache: false,
      })
      if (res.ok) return []
      return problems.length > 0 ? problems : [res.error]
    },
  }
}

type AskResult = { answerable: boolean; reply: string }

/** One question about a tile, through askProblems, then the case's own judgement of the reply. */
function askCase(
  label: string,
  slot: AskSlot,
  question: string,
  judge: (v: AskResult) => string[],
  answers: StoredAnswers = PROFILE.answers,
): CheckCase {
  return {
    label,
    async run(ai, pin) {
      const road = profileRoad(answers)
      if (!road) return NO_ROAD
      const facts = askFacts(road.spec, slot, road.answers, [])
      let problems: string[] = []
      const res = await ai.generateJson(pin(STUDENT_ASK), {
        data: { ...facts, question },
        verify: (v) => {
          problems = askProblems(v, facts)
          return problems
        },
        cache: false,
      })
      if (!res.ok) return problems.length > 0 ? problems : [res.error]
      return judge(res.value)
    },
  }
}

type WordsReading = ReturnType<typeof checkOwnWords>

/** Her words on one step, read by STUDENT_WORDS and kept by checkOwnWords, then judged. */
function wordsCase(
  label: string,
  step: OwnWordsStep,
  text: string,
  where: string | null,
  judge: (read: WordsReading) => string[],
): CheckCase {
  return {
    label,
    async run(ai, pin) {
      const res = await ai.generateJson(pin(STUDENT_WORDS), {
        data: { text, questions: ownWordsQuestions(step) },
        cache: false,
      })
      if (!res.ok) return [res.error]
      return judge(checkOwnWords(step, text, res.value, {}, where))
    },
  }
}

const keeps = (read: WordsReading, key: string): string[] =>
  read.chips.some((c) => c.key === key) ? [] : [`No ${key} chip was kept.`]

const answered = (v: AskResult): string[] =>
  v.answerable ? [] : [`It refused: "${v.reply}"; the rows answer this question.`]

/** The words of words-hindi that say how she feels. */
const FELT = ['akela feel hota hai']

export const CHECK_CASES: readonly CheckCase[] = [
  whyCase('why-course', 'course'),
  whyCase('why-alt-course', 'alt-course'),
  askCase('ask-answer', 'course', 'What subjects will I study?', answered),
  askCase('ask-no-data', 'course', 'What is the visa processing time?', (v) =>
    !v.answerable && v.reply.trim() === NO_DATA
      ? []
      : [`It answered "${v.reply}"; the rows hold no processing time, so it says "${NO_DATA}".`],
  ),
  askCase(
    'ask-afford',
    'course',
    'Can I afford this on my budget?',
    (v) => [
      ...answered(v),
      ...(v.answerable && !v.reply.includes('AUD') ? ['The reply gives no amount in AUD.'] : []),
    ],
    { ...PROFILE.answers, amount: { value: 30, state: 'stated' } },
  ),
  wordsCase(
    'words-english',
    'study',
    'I want to do data science, a masters, hands-on with internships',
    null,
    (read) => keeps(read, 'field'),
  ),
  // Amounts are AUD thousands once checkOwnWords has converted and snapped them. Who pays is
  // hidden (16 Oct 2026), so her father paying is no chip to keep.
  wordsCase(
    'words-nepali',
    'facts',
    'mero budget 25 lakh jati ho, ghar ma buwa le tirnuhuncha',
    'Nepal',
    (read) =>
      read.chips.some((c) => c.key === 'amount' && typeof c.value === 'number')
        ? []
        : ['No amount chip in AUD was kept.'],
  ),
  // Judged by the words labelled as her feeling, never the app's own word list.
  wordsCase(
    'words-hindi',
    'living',
    'mera cousin Sydney mein rehta hai, mujhe akela feel hota hai',
    'India',
    (read) => [
      ...read.chips
        .filter((c) => wellbeingChips(FELT, [c]) > 0)
        .map((c) => `A wellbeing chip was kept: ${c.key} "${c.quote}".`),
      ...(untaggedWellbeing(FELT, read.tags) > 0 ? [`No wellbeing tag holds "${FELT[0]}".`] : []),
    ],
  ),
]
