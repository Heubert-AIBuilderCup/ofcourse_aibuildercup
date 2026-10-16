// The levels a student may be offered, from the qualification she stated (criterion 60): a school
// leaver a Diploma or a Bachelor's, a Diploma holder a Bachelor's, a graduate a Master's. "Not
// sure", no answer or an assumed one gates nothing. When no road is at a level she may enter, she
// is offered one at her own level or below, never above. Pure, so the matcher and its tests read
// the same rule.

import type { Level } from '@/features/engine/types'
import type { StoredAnswers } from '@/shared/types/student'

const OPENS: Readonly<Record<string, Level[]>> = {
  'High school': ['Diploma', "Bachelor's"],
  Diploma: ["Bachelor's"],
  "Bachelor's": ["Master's"],
  "Master's": ["Master's"],
}

/** Her own level or below: what she is offered when no road opens to her. */
const AT_OR_BELOW: Readonly<Record<string, Level[]>> = {
  'High school': ['Diploma'],
  Diploma: ['Diploma'],
  "Bachelor's": ["Bachelor's", 'Diploma'],
  "Master's": ["Master's", "Bachelor's", 'Diploma'],
}

const statedQual = (answers: StoredAnswers): string | null => {
  const qual = answers.qual
  return qual?.state === 'stated' && typeof qual.value === 'string' ? qual.value : null
}

/** The levels her qualification opens; null when she stated none it can read. */
export function levelsOpenTo(answers: StoredAnswers): Level[] | null {
  const qual = statedQual(answers)
  return qual === null ? null : (OPENS[qual] ?? null)
}

/**
 * The roads she may be offered: those at a level her qualification opens, else those at her own
 * level or below, never above, so none when none is left. Every road when she stated no
 * qualification it can read.
 */
export function eligibleRoads<T extends { level: Level }>(
  answers: StoredAnswers,
  roads: readonly T[],
): readonly T[] {
  const qual = statedQual(answers)
  const opens = qual === null ? undefined : OPENS[qual]
  if (!opens) return roads
  const open = roads.filter((r) => opens.includes(r.level))
  if (open.length > 0) return open
  return roads.filter((r) => AT_OR_BELOW[qual as string].includes(r.level))
}
