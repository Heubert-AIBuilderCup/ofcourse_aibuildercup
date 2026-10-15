// The demo paid-work source ("Hours of paid work and first-year results") and its twin, for the text tool tests.
// The wording lives in demo-sources; this only gives the paragraphs their refs.

import { PAID_WORK_TEXTS } from '../demo-sources/paid-work'
import { TWIN_TEXTS } from '../demo-sources/paid-work-twin'
import type { Paragraph } from '../model/types'

const withRefs = (texts: readonly string[]): Paragraph[] =>
  texts.map((text, i) => ({ ref: `¶${i + 1}`, text }))

export const PAID_WORK_PARAGRAPHS: Paragraph[] = withRefs(PAID_WORK_TEXTS)

export const TWIN_PARAGRAPHS: Paragraph[] = withRefs(TWIN_TEXTS)
