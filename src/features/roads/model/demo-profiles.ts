// Six students, one per road, each reaching its road with nothing left over: the matcher's tests,
// the why's and the demo use them. Fixtures, kept out of the matcher so they never ship with it.

import { PARTICULAR } from '@/features/opening/model/questions'
import type { QuestionKey, Relative, StoredAnswers } from '@/shared/types/student'

/** Answers she stated, from their values. */
export const stated = (
  values: Partial<Record<QuestionKey, string | number | string[]>>,
): StoredAnswers =>
  Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, { value, state: 'stated' as const }]),
  )

/** Her person, known only by the place they live. */
export const relativeAt = (placeId: string): Relative => ({
  placeId,
  place: null,
  relationship: null,
  name: null,
})

/** Six students, one per road: each reaches its road with nothing left over. The demo reuses them. */
export const DEMO_PROFILES: readonly {
  name: string
  answers: StoredAnswers
  relative: Relative | null
  roadId: string
}[] = [
  {
    name: 'Cyber security in Perth',
    answers: stated({ stay: 'Yes', know: PARTICULAR, field: 'Cyber security', level: "Master's" }),
    relative: relativeAt('perth-cbd'),
    roadId: 'perth-cyber',
  },
  {
    name: 'Information technology in Adelaide',
    answers: stated({
      stay: 'Yes',
      know: PARTICULAR,
      field: 'Information technology',
      level: "Master's",
      place: 'Regional',
    }),
    relative: relativeAt('adelaide-cbd'),
    roadId: 'adelaide-it',
  },
  {
    name: 'Data science in Sydney',
    answers: stated({
      stay: 'Yes',
      know: PARTICULAR,
      field: 'Data science',
      level: "Master's",
      focus: 'Career-focused',
    }),
    relative: null,
    roadId: 'sydney-data',
  },
  {
    name: 'Business analytics in Geelong',
    answers: stated({
      stay: 'Not sure',
      know: PARTICULAR,
      field: 'Business analytics',
      level: "Master's",
    }),
    relative: null,
    roadId: 'geelong-business',
  },
  {
    name: 'Information technology in Hobart',
    answers: stated({
      stay: 'Yes',
      know: PARTICULAR,
      field: 'Information technology',
      level: "Master's",
    }),
    relative: relativeAt('hobart'),
    roadId: 'hobart-it',
  },
  {
    name: 'Data science, then home',
    answers: stated({ stay: 'No', know: PARTICULAR, field: 'Data science', level: "Master's" }),
    relative: null,
    roadId: 'melbourne-home',
  },
]
