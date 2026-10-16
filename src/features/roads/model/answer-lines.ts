// Her answers as the why and Ask are given them (criterion 68): each under the question she read,
// her budget as "AUD 30k a year", and an answer she left to its default marked ", assumed". Pure.

import { display, isVisible, questionOf, SCREENS } from '@/features/opening/model/questions'
import {
  QUESTION_KEYS,
  type QuestionKey,
  type StoredAnswer,
  type StoredAnswers,
} from '@/shared/types/student'

export type AnswerLine = { question: string; answer: string }

const ITEM_TITLE = new Map(
  SCREENS.flatMap((screen) =>
    screen.items.flatMap((item) => item.questions.map((q) => [q.key, item.title] as const)),
  ),
)

/** A question as she read it: its label, or its item's title when the title asks it. */
const questionText = (key: QuestionKey): string =>
  questionOf(key).label || (ITEM_TITLE.get(key) ?? key)

/** Her budget is asked under "Your budget per year"; its own label, "Amount", says nothing alone. */
const QUESTION: Partial<Record<QuestionKey, string>> = { amount: 'Your budget per year' }

const answerText = (key: QuestionKey, { value, state }: StoredAnswer): string => {
  const text =
    key === 'amount' && typeof value === 'number' ? `AUD ${value}k a year` : display(value)
  return state === 'assumed' ? `${text}, assumed` : text
}

/** Her stated or assumed answers that her answers still show, as question and answer. */
export function answerLines(answers: StoredAnswers): AnswerLine[] {
  return QUESTION_KEYS.flatMap((key) => {
    const stored = answers[key]
    if (!stored || !isVisible(key, answers)) return []
    return [{ question: QUESTION[key] ?? questionText(key), answer: answerText(key, stored) }]
  })
}
