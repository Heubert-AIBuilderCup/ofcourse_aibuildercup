// What "Use these" stores from a reading of her own words, and where the step goes next. Client-safe:
// the chips' type alone comes from ./own-words, whose values load the full zod.

import type { OwnWordsStep, QuestionKey, Relative, StoredAnswers } from '@/shared/types/student'
import { firstOpenQuestion, OWN_WORDS_STEP_OF, questionPath } from './onboarding'
import type { OwnWordsChip } from './own-words'
import { isVisible } from './questions'

/**
 * The chips she kept (by their place in the reading), each a stated answer, less any whose
 * question her answers with them would not ask (a field kept while the "know" that opens it was
 * not).
 */
export function ownWordsPatch(
  chips: OwnWordsChip[],
  selected: Set<number>,
  answers: StoredAnswers,
): StoredAnswers {
  const patch: StoredAnswers = {}
  chips.forEach((chip, i) => {
    if (selected.has(i)) patch[chip.key] = { value: chip.value, state: 'stated' }
  })
  const after = { ...answers, ...patch }
  return Object.fromEntries(
    Object.entries(patch).filter(([key]) => isVisible(key as QuestionKey, after)),
  ) as StoredAnswers
}

/**
 * The question to show once her chips are stored: the step's first still unanswered, else its last
 * (as the bare step page opens it), so a question a chip answered is skipped.
 */
export function afterOwnWords(
  step: OwnWordsStep,
  answers: StoredAnswers,
  relative: Relative | null,
): string {
  const n = OWN_WORDS_STEP_OF[step]
  return questionPath(n, firstOpenQuestion(n, answers, relative))
}
