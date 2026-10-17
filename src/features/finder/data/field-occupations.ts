// Each broad field's occupations, computed from the courses of that field in the catalogue, so a
// finder course's PR and career lines follow the same occupation lists as the board's courses.

import { COURSES } from '@/features/engine/catalogue'
import type { FieldId } from '@/features/engine/types'
import { EXTRA_COURSES } from '@/features/roads/data/courses'
import { occupationsFor } from '@/features/roads/data/occupations'

const ALL_COURSES = [...COURSES, ...EXTRA_COURSES]

/** The codes the catalogue's courses of a field lead to, each once. */
const codesOf = (field: FieldId): readonly string[] => [
  ...new Set(
    ALL_COURSES.filter((c) => c.field === field).flatMap((c) =>
      occupationsFor(c.id).map((o) => o.code),
    ),
  ),
]

/** The OCCUPATIONS codes each field leads to; [] gives "no clear PR". */
export const FIELD_OCCUPATIONS: Readonly<Record<FieldId, readonly string[]>> = {
  cyber: codesOf('cyber'),
  data: codesOf('data'),
  business: codesOf('business'),
  it: codesOf('it'),
  psych: codesOf('psych'),
  health: codesOf('health'),
  engineering: codesOf('engineering'),
  design: codesOf('design'),
}

/**
 * A niche graph field's own occupations, where its broad field's list would mislead: health
 * informatics leads to health information and IT work, not to nursing or community work.
 */
const GRAPH_FIELD_OCCUPATIONS: Readonly<Partial<Record<string, readonly string[]>>> = {
  'health-informatics': ['224213', ...FIELD_OCCUPATIONS.it],
}

/** The OCCUPATIONS codes a course leads to: its graph field's own list, else its broad field's. */
export const occupationCodesFor = (field: FieldId, graphField: string): readonly string[] =>
  GRAPH_FIELD_OCCUPATIONS[graphField] ?? FIELD_OCCUPATIONS[field]
