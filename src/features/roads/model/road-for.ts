// The road a roadmap shows: the road its answers match (hand-written or composed, through
// specById), else the nearest, else Priya's marked illustrative; Priya's as it always was when the
// switch is off. The match goes with it, so the why can name the rules that chose each tile. Pure.

import { PRIYA } from '@/features/road/model/fixture'
import type { Road } from '@/features/road/model/road-data'
import type { Relative, StoredAnswers } from '@/shared/types/student'
import type { RoadSpec } from '../data/types'
import { studentRoadsOff } from '../switch'
import { buildRoad } from './build'
import { specById } from './compose'
import { type Difference, type Match, matchRoad } from './match'

export type RoadFor = {
  road: Road
  kind: 'matched' | 'nearest' | 'illustrative' | 'off'
  spec: RoadSpec | null
  /** How her answers matched the road; null when no road was matched. */
  match: Match | null
  differences: Difference[]
}

type Input = { answers: StoredAnswers; relative: Relative | null }

export function roadFor(
  input: Input,
  env: Record<string, string | undefined>,
  build: typeof buildRoad = buildRoad,
): RoadFor {
  if (studentRoadsOff(env))
    return { road: PRIYA, kind: 'off', spec: null, match: null, differences: [] }
  try {
    const match = matchRoad(input.answers, input.relative)
    const spec = specById(match.spec.id)
    if (!spec) throw new Error(`No road "${match.spec.id}"`)
    return {
      road: build(spec, {
        answers: input.answers,
        match: { differences: match.differences, relative: input.relative },
      }),
      kind: match.exact ? 'matched' : 'nearest',
      spec,
      match,
      differences: match.differences,
    }
  } catch (err) {
    console.error('[roads.roadFor]', err)
    return { road: PRIYA, kind: 'illustrative', spec: null, match: null, differences: [] }
  }
}
