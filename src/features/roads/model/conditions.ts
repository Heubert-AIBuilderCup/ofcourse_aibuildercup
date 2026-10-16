// What a course asks of her before she enrols, read against what she has said: its English score
// (met, not met, or not known yet) and, for the one field-specific Master's, a bachelor's degree
// in that field. The course's own entry rule (data/entry.ts) says what it asks; her answers only
// decide met or not met, and the English comparison is `englishMeets` alone (opening's english.ts,
// which the answers panel's preview reads too): her test and score read through `ieltsEquivalent`
// (PTE and TOEFL by the mock table). Pure.

import {
  englishMeets,
  ieltsEquivalent,
  NOT_TAKEN,
  parseEnglish,
} from '@/features/opening/model/english'
import type { StoredAnswer, StoredAnswers } from '@/shared/types/student'
import { entryOf } from '../data/entry'

export type Condition = {
  id: 'english' | 'degree'
  /** "Needs IELTS 7.0". */
  text: string
  /** True or false once her answer decides it; null while it does not. */
  met: boolean | null
  explanation: string
}

const TAKE_THE_TEST = 'Take the test before you enrol'

/**
 * What she has and how it compares. An IELTS answer reads "You have 6.5"; a PTE or TOEFL score
 * names its mock IELTS equivalent beside it.
 */
function explain(eng: StoredAnswer, required: number, met: boolean): string {
  const english = parseEnglish(eng.value)
  if (english && english.test !== 'IELTS') {
    const have = `You have ${String(eng.value)} (about IELTS ${ieltsEquivalent(english).toFixed(1)}, mock)`
    return met ? `${have}, so it is met` : `${have}; this course needs IELTS ${required.toFixed(1)}`
  }
  const have = `You have ${String(eng.value).replace(/^IELTS /, '')}`
  return met ? `${have}, so it is met` : `${have}, so it isn't met yet`
}

function englishCondition(required: number, eng: StoredAnswer | undefined): Condition {
  const met = englishMeets(eng, required)
  const explanation =
    met === null || !eng || eng.value === NOT_TAKEN ? TAKE_THE_TEST : explain(eng, required, met)
  return { id: 'english', text: `Needs IELTS ${required.toFixed(1)}`, met, explanation }
}

/**
 * A course's entry conditions, English first: always its score, and a degree in its field where
 * the course asks one (the Master of Engineering; Nursing is graduate entry, open to any
 * bachelor's). Her field of degree is not asked, so the degree condition is never decided.
 * Empty for a course the catalogue has no entry rule for.
 */
export function courseConditions(courseId: string, answers: StoredAnswers): Condition[] {
  const entry = entryOf(courseId)
  if (!entry) return []
  const conditions = [englishCondition(entry.ielts, answers.eng)]
  if (entry.needsDegreeIn) {
    conditions.push({
      id: 'degree',
      text: `Needs a bachelor’s degree in ${entry.needsDegreeIn}`,
      met: null,
      explanation: `The course asks for a bachelor’s degree in ${entry.needsDegreeIn} before you enrol.`,
    })
  }
  return conditions
}
