// Whether changing her answers would move her to another road, in the words "Your answers" shows
// before she saves. The same rule the board is drawn by (matchRoad), so the preview says what the
// saved answers will draw. Pure.

import type { Relative, StoredAnswers } from '@/shared/types/student'
import { ROAD_CANDIDATES } from '../data/candidates'
import type { RoadKey } from '../data/types'
import { matchRoad } from './match'

/**
 * "Your road changes to <label>." when the road her answers match changes; null when it stays, or
 * when either set of answers matches no road (no road at her level): the preview then names no
 * change rather than break the panel, and the board draws what roadFor draws.
 */
export function roadChange(
  before: StoredAnswers,
  after: StoredAnswers,
  relative: Relative | null,
  roads: readonly RoadKey[] = ROAD_CANDIDATES,
): string | null {
  try {
    const was = matchRoad(before, relative, roads).spec
    const now = matchRoad(after, relative, roads).spec
    return was.id === now.id ? null : `Your road changes to ${now.label}.`
  } catch {
    return null
  }
}
