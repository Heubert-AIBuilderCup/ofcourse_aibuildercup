// Priya, the design's walkthrough student, and her cousin Anjali: the engine's tests and the
// futures screen's tests share these, so both prove the same futures.

import type { Relative, StoredAnswers } from '@/shared/types/student'

export const PRIYA_ANSWERS: StoredAnswers = {
  know: { value: 'Something particular', state: 'stated' },
  field: { value: 'Cyber security', state: 'stated' },
  level: { value: "Master's", state: 'stated' },
  amount: { value: 30, state: 'stated' },
  covers: { value: 'Fees only', state: 'stated' },
  hard: { value: 'Roughly', state: 'stated' },
  latest: { value: 'Jul 2027', state: 'stated' },
  stay: { value: 'Yes', state: 'stated' },
  place: { value: 'Regional', state: 'stated' },
  community: { value: 'A little', state: 'stated' },
  focus: { value: 'Career-focused', state: 'stated' },
  earn: { value: 'Helpful', state: 'stated' },
  learn: { value: 'Hands-on with placements', state: 'stated' },
}

export const ANJALI: Relative = {
  placeId: 'cannington',
  place: 'Cannington',
  relationship: 'Cousin',
  name: 'Anjali',
}
