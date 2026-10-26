// The finder's hard filters (criterion 4): the levels her qualification opens, her destination and
// her budget. Only what she stated counts: an assumed answer (a default she never picked) reads as
// unanswered and gates nothing. Pure, so the search and the comparison read the same rule.

import { cityById } from '@/features/engine/catalogue'
import type { Level } from '@/features/engine/types'
import { levelsOpenTo } from '@/features/roads/model/eligibility'
import type { QuestionKey, StoredAnswers } from '@/shared/types/student'
import type { FilterKey } from './types'

/** Every catalogue course is in Australia, and both destination answers include it. */
const DESTINATIONS = ['Australia', 'Open to others']

const said = (answers: StoredAnswers, key: QuestionKey) => {
  const answer = answers[key]
  return answer?.state === 'stated' ? answer.value : undefined
}

/** The rules a course fails for her answers, in order; empty when it passes all three. */
export function failedFilters(
  answers: StoredAnswers,
  course: { level: Level; feeK: number; cityId: string },
): FilterKey[] {
  const failed: FilterKey[] = []

  const levels = levelsOpenTo(answers)
  if (levels && !levels.includes(course.level)) failed.push('level')

  const amount = said(answers, 'amount')
  if (typeof amount === 'number') {
    const living =
      said(answers, 'covers') === 'Fees and living' ? cityById(course.cityId).livingK : 0
    if (course.feeK + living > amount) failed.push('fee')
  }

  const dest = said(answers, 'dest')
  if (typeof dest === 'string' && !DESTINATIONS.includes(dest)) failed.push('destination')

  return failed
}
