// The road a roadmap shows: the road around the course it is pinned to, else the road its answers
// match (hand-written or composed, through specById), else the nearest, else Priya's marked
// illustrative; Priya's as it always was when the switch is off. A pinned road ends as the matched
// one does (staying or home); her answers changing moves nothing else: the pin stays. The match
// goes with it, so the why can name the rules that chose each tile. Pure.

import { PRIYA } from '@/features/road/model/fixture'
import type { Road } from '@/features/road/model/road-data'
import type { Pinned, Relative, StoredAnswers } from '@/shared/types/student'
import { courseById } from '../data/courses'
import type { RoadSpec } from '../data/types'
import { studentRoadsOff } from '../switch'
import { buildRoad } from './build'
import { composeRoad, specById } from './compose'
import { type Difference, type Match, matchRoad } from './match'
import { pinnedMatch } from './why'

export type RoadFor = {
  road: Road
  kind: 'matched' | 'nearest' | 'pinned' | 'illustrative' | 'off'
  spec: RoadSpec | null
  /** How her answers matched the road; null when no road was matched. */
  match: Match | null
  differences: Difference[]
}

/** `pinned`: the course its roadmap was made around; an unknown one is passed over. */
type Input = { answers: StoredAnswers; relative: Relative | null; pinned?: Pinned }

export function roadFor(
  input: Input,
  env: Record<string, string | undefined>,
  build: typeof buildRoad = buildRoad,
): RoadFor {
  if (studentRoadsOff(env))
    return { road: PRIYA, kind: 'off', spec: null, match: null, differences: [] }
  try {
    const match = matchRoad(input.answers, input.relative)
    const pinned =
      input.pinned && courseById(input.pinned.courseId)
        ? composeRoad({ ...input.pinned, stays: match.spec.stays })
        : null
    const spec = pinned ?? specById(match.spec.id)
    if (!spec) throw new Error(`No road "${match.spec.id}"`)
    return {
      road: build(spec, {
        answers: input.answers,
        // A pinned road's why says she chose its course, never the matched road's rules.
        match: pinned
          ? pinnedMatch(spec, input.answers)
          : { differences: match.differences, relative: input.relative },
      }),
      kind: pinned ? 'pinned' : match.exact ? 'matched' : 'nearest',
      spec,
      match,
      differences: match.differences,
    }
  } catch (err) {
    console.error('[roads.roadFor]', err)
    return { road: PRIYA, kind: 'illustrative', spec: null, match: null, differences: [] }
  }
}
