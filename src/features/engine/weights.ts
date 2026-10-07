// DS-D3: how much she weighs each dimension, 0–3, derived from her opening answers, with the
// reason the weights plaque shows. Family is never weighed in this slice.

import { effective, isAssumed } from '@/features/opening'
import type { AnswerValue, QuestionKey, StoredAnswers } from '@/shared/types/student'
import { PREVIEW_TODAY } from './catalogue'
import { DIMENSIONS, type Dimension, type Weight, type Weights } from './types'

/** What each dimension weighs when its driving answer is assumed. */
const DEFAULT_WEIGHTS: Weights = { cost: 2, time: 2, work: 2, pr: 2, location: 1, career: 2 }
const DEFAULT_REASONS: Record<Dimension, string> = {
  cost: 'Not sure: assumed 2',
  time: 'Not sure: assumed 2',
  work: 'Not sure: assumed 2',
  pr: 'Not sure: assumed 2',
  location: 'No preference: 1',
  career: 'Not sure: assumed 2',
}

/** The answer that sets each dimension's weight. */
const DRIVER: Record<Dimension, QuestionKey> = {
  cost: 'hard',
  time: 'latest',
  work: 'earn',
  pr: 'stay',
  location: 'place',
  career: 'focus',
}

/** A base weight, its reason, and the +1 that applies when another stated answer adds it. */
type Rule = { base: Weight; reason: string; plus?: string | false }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Months from PREVIEW_TODAY to a start such as "Jul 2027". */
function monthsUntil(start: AnswerValue): number {
  const [month, year] = String(start).split(' ')
  const [fromYear, fromMonth] = PREVIEW_TODAY.split('-').map(Number)
  return (Number(year) - fromYear) * 12 + (MONTHS.indexOf(month) + 1 - fromMonth)
}

/** A modifier counts only when she said it herself, never from a default. */
const stated = (answers: StoredAnswers, key: QuestionKey) =>
  answers[key]?.state === 'stated' ? answers[key].value : undefined

const RULES: Record<Dimension, (value: AnswerValue, answers: StoredAnswers) => Rule> = {
  cost: (v, a) => ({
    ...(v === 'Hard limit'
      ? { base: 3, reason: 'A hard limit: 3' }
      : { base: 2, reason: 'A rough budget: 2' }),
    plus: stated(a, 'who') === 'Loan' && 'paying by loan',
  }),
  time: (v, a) => {
    const months = monthsUntil(v)
    return {
      ...(months <= 6
        ? { base: 3, reason: 'Latest start within 6 months: 3' }
        : months <= 12
          ? { base: 2, reason: 'Latest start within a year: 2' }
          : { base: 1, reason: 'Latest start more than a year away: 1' }),
      plus: stated(a, 'length') === 'As short as possible' && 'as short as possible',
    }
  },
  work: (v) =>
    v === 'Yes'
      ? { base: 3, reason: 'Need to earn: yes · 3' }
      : v === 'No'
        ? { base: 1, reason: 'Need to earn: no · 1' }
        : { base: 2, reason: 'Need to earn: helpful · 2' },
  pr: (v) =>
    v === 'Yes'
      ? { base: 3, reason: 'Stay after: yes · 3 · routes with no PR path seal' }
      : v === 'No'
        ? { base: 0, reason: 'Stay after: no · 0' }
        : { base: 2, reason: 'Stay after: not sure · 2' },
  location: (v, a) => {
    const community = stated(a, 'community')
    return {
      base: 2,
      reason: `${v} chosen: 2`,
      plus: (community === 'Yes' || community === 'A little') && 'community matters',
    }
  },
  career: (v, a) => ({
    ...(v === 'Academic'
      ? { base: 1, reason: 'Academic: 1' }
      : { base: 3, reason: 'Career-focused: 3' }),
    plus: stated(a, 'learn') === 'Hands-on with placements' && 'placements',
  }),
}

const capped = (n: number): Weight => Math.min(n, 3) as Weight

export function deriveWeights(answers: StoredAnswers): {
  weights: Weights
  reasons: Record<Dimension, string>
} {
  const weights = { ...DEFAULT_WEIGHTS }
  const reasons = { ...DEFAULT_REASONS }
  for (const dim of DIMENSIONS) {
    const value = effective(answers, DRIVER[dim])
    if (isAssumed(answers, DRIVER[dim]) || value === undefined) continue
    const { base, reason, plus } = RULES[dim](value, answers)
    weights[dim] = plus ? capped(base + 1) : base
    reasons[dim] = plus ? `${reason} · ${plus} +1` : reason
  }
  return { weights, reasons }
}
