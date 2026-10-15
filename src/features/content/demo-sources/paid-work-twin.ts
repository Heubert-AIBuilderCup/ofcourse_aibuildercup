// The twin of "paid-work": the same paragraphs, but ¶3 says 9 points and the title carries the planted claim.

import { PAID_WORK_TEXTS } from './paid-work'

export const TWIN_TITLE = 'Past 20 hours a week, pass rates drop 11 points'

export const TWIN_TEXTS = PAID_WORK_TEXTS.map((text, i) =>
  i === 2
    ? 'Above 20 hours a week, pass rates fell by 9 percentage points. The drop was largest in the first year of study.'
    : text,
)
