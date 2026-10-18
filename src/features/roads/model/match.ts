// Matching her answers to the nearest road. Her qualification first decides which levels she may
// be offered (eligibility.ts), never above it. Then four rules read what she stated, in order
// (stay, field, level, city hint); an answer stored as assumed is unanswered. Roads compare rule by
// rule, then a course that asks no degree in its own field comes first, then the order of the
// candidates (the six hand-written roads, then the catalogue's). Nothing is ranked or scored
// beyond that, the budget is never read, and the code decides: no model is asked. When her
// qualification shaped the road (it closed her field, or no road is at a level it opens), a `qual`
// difference says so, whether or not she gave a level. It reads only the roads' keys, never their
// copy, so the board's preview can run it in the browser. Pure.

import { cityById, placeById } from '@/features/engine/catalogue'
import type { Level } from '@/features/engine/types'
import { DRAWN_TO_AREAS, PARTICULAR, SUGGEST_ME } from '@/features/opening/model/questions'
import type { QuestionKey, Relative, StoredAnswers } from '@/shared/types/student'
import { ROAD_CANDIDATES } from '../data/candidates'
import { openEntry } from '../data/entry'
import { AREA_FIELDS, areaFields, FIELD_OF_OPTION, FIELDS } from '../data/fields'
import { stayingRoute } from '../data/occupations'
import type { RoadKey } from '../data/types'
import { eligibleRoads, levelsOpenTo } from './eligibility'

export type Difference = {
  key: 'stay' | 'field' | 'areas' | 'level' | 'place' | 'qual'
  yours: string
  road: string
  /**
   * On the city hint, when the road's own city shares the reason her hint gave for the cities it
   * named, in the chip's words ("which counts as regional too"). On the qualification, how it
   * shaped the road ("Design is taught here only as a Master's, which your qualification does not
   * open").
   */
  because?: string
}
/** The stay difference's road on a staying road with no clear road to PR. */
const NO_CLEAR_PR = 'No clear PR'

/** The nearest road, by its key; `exact` when every rule she answered agrees with it. */
export type Match = { spec: RoadKey; exact: boolean; differences: Difference[] }

/** A rule she answered: what she said, what the road says, and whether a road agrees. */
type Rule = {
  key: Difference['key']
  yours: string
  road: (spec: RoadKey) => string
  matches: (spec: RoadKey) => boolean
  because?: (spec: RoadKey) => string | undefined
}

const fieldName = (spec: RoadKey): string =>
  FIELDS.find((f) => f.id === spec.field)?.name ?? spec.field

/** What she said: an answer stored as assumed (a default she never picked) reads as unanswered. */
const said = (answers: StoredAnswers, key: QuestionKey) => {
  const answer = answers[key]
  return answer?.state === 'stated' ? answer.value : undefined
}

const text = (answers: StoredAnswers, key: QuestionKey): string | null => {
  const value = said(answers, key)
  return typeof value === 'string' ? value : null
}

/** A staying road whose course the catalogue gives no clear road to PR (stayingRoute's 'none'). */
const noClearPr = (spec: RoadKey): boolean =>
  spec.stays && stayingRoute(spec.courseId, spec.cityId) === 'none'

/**
 * She said she'd stay (or might), and the road stays but has no clear road to PR: the strip says
 * so, in the stay chip's place. Matching still reads the road as staying.
 */
function stayNoPr(answers: StoredAnswers, spec: RoadKey): Difference | null {
  const stay = text(answers, 'stay')
  if ((stay !== 'Yes' && stay !== 'Not sure') || !noClearPr(spec)) return null
  return { key: 'stay', yours: stay, road: NO_CLEAR_PR }
}

function stayRule(answers: StoredAnswers): Rule | null {
  const stay = text(answers, 'stay')
  if (stay !== 'Yes' && stay !== 'Not sure' && stay !== 'No') return null
  const wantsToStay = stay !== 'No'
  return {
    key: 'stay',
    yours: stay,
    road: (spec) => (spec.stays ? 'Stays' : 'Goes home'),
    matches: (spec) => spec.stays === wantsToStay,
  }
}

type FieldPick = { key: 'field' | 'areas'; yours: string; fields: string[] }

/** The field from `field` when she knows what she wants (or did not say), from `areas` when drawn to some. */
function fieldPick(answers: StoredAnswers): FieldPick | null {
  const know = text(answers, 'know')
  if (know === SUGGEST_ME) return null
  if (know === DRAWN_TO_AREAS) {
    const value = said(answers, 'areas')
    const areas = Array.isArray(value) ? value : []
    if (areas.length === 0) return null
    const fields = [...new Set(areas.flatMap(areaFields))]
    return { key: 'areas', yours: areas.join(', '), fields }
  }
  if (know !== null && know !== PARTICULAR) return null
  const field = text(answers, 'field')
  const id = field === null ? undefined : FIELD_OF_OPTION[field]
  if (field === null || id === undefined) return null
  return { key: 'field', yours: field, fields: [id] }
}

/**
 * The fields she picked, read as the matcher reads them (an area no road has reaches none); null
 * when she picked none, so a caller falls back to the road's own field.
 */
export const pickedFields = (answers: StoredAnswers): string[] | null =>
  fieldPick(answers)?.fields ?? null

/**
 * The areas none of whose fields any candidate road teaches: onboarding notes on each that it
 * borrows the nearest field. Read from the candidates, so an area gains or loses its note with the
 * catalogue. Plain names, for the study page to hand to its question screen.
 */
export function areasWithoutRoads(candidates: readonly RoadKey[] = ROAD_CANDIDATES): string[] {
  const taught = new Set<string>(candidates.map((c) => c.field))
  return Object.entries(AREA_FIELDS)
    .filter(([, fields]) => !fields.some((field) => taught.has(field)))
    .map(([area]) => area)
}

function fieldRule(answers: StoredAnswers): Rule | null {
  const pick = fieldPick(answers)
  if (!pick) return null
  const { key, yours, fields } = pick
  return { key, yours, road: fieldName, matches: (spec) => fields.includes(spec.field) }
}

function levelRule(answers: StoredAnswers): Rule | null {
  const level = text(answers, 'level')
  if (level === null) return null
  return {
    key: 'level',
    yours: level,
    road: (spec) => spec.level,
    matches: (spec) => spec.level === level,
  }
}

/** Her person, as the city hint's reason names them. */
function whereTheyLive({ relationship }: Relative): string {
  return relationship && relationship !== 'Other'
    ? `where your ${relationship.toLowerCase()} lives`
    : 'where the person you know lives'
}

/**
 * Her hint and its source (`yours`), the cities it names, why it chose a city it names as the why
 * says it (`chose`), and, where a city it does not name can share its reason, that reason as the
 * chip says it.
 */
export type Hint = {
  yours: string
  cities: readonly string[]
  chose: string
  shared?: { by: (cityId: string) => boolean; because: string }
}

const namesOf = (cities: readonly string[]) => cities.map((id) => cityById(id).name).join(' or ')

/** The city hint: her relative's city, else a regional place, else a career focus. */
export function cityHint(answers: StoredAnswers, relative: Relative | null): Hint | null {
  const relativePlace = relative?.placeId ? placeById(relative.placeId) : undefined
  if (relative && relativePlace) {
    return {
      yours: `${relativePlace.name}, ${whereTheyLive(relative)}`,
      cities: [relativePlace.cityId],
      chose: whereTheyLive(relative),
    }
  }
  if (text(answers, 'place') === 'Regional') {
    const cities = ['perth', 'adelaide']
    return {
      yours: `regional, which points to ${namesOf(cities)}`,
      cities,
      chose: 'it counts as regional, and you said regional',
      shared: { by: (id) => cityById(id).regional, because: 'which counts as regional too' },
    }
  }
  if (text(answers, 'focus') === 'Career-focused') {
    const cities = ['sydney']
    return {
      yours: `career-focused, which points to ${namesOf(cities)}`,
      cities,
      chose: 'its job market, and you said career-focused',
    }
  }
  return null
}

/**
 * A road elsewhere differs by its own city from the cities her hint named: the chip names the
 * road's city, her hint and its source, and the reason they share when they share one.
 */
function cityRule(answers: StoredAnswers, relative: Relative | null): Rule | null {
  const hint = cityHint(answers, relative)
  if (!hint) return null
  const { yours, cities, shared } = hint
  return {
    key: 'place',
    yours,
    road: (spec) => cityById(spec.cityId).name,
    matches: (spec) => cities.includes(spec.cityId),
    because: (spec) => (shared?.by(spec.cityId) ? shared.because : undefined),
  }
}

/** The rules she answered, in the order roads compare by. */
const rulesOf = (answers: StoredAnswers, relative: Relative | null): Rule[] =>
  [stayRule(answers), fieldRule(answers), levelRule(answers), cityRule(answers, relative)].filter(
    (rule): rule is Rule => rule !== null,
  )

const LEVEL_ORDER: readonly Level[] = ['Diploma', "Bachelor's", "Master's"]
const levelsText = (levels: readonly Level[]): string =>
  LEVEL_ORDER.filter((l) => levels.includes(l)).join(' or a ')

/**
 * How her qualification shaped the road, in the chip's words: her field is taught only at levels
 * it does not open, or no road is at a level it opens. Null when she stated no qualification that
 * gates, or it changed nothing.
 */
function qualReason(answers: StoredAnswers, roads: readonly RoadKey[]): string | null {
  const opens = levelsOpenTo(answers)
  if (!opens) return null
  const pool = eligibleRoads(answers, roads)
  const pick = fieldPick(answers)
  const inField = pick ? roads.filter((r) => pick.fields.includes(r.field)) : []
  if (pick && inField.length > 0 && !inField.some((r) => pool.includes(r))) {
    const levels = levelsText(inField.map((r) => r.level))
    return `${pick.yours} is taught here only as a ${levels}, which your qualification does not open`
  }
  if (!roads.some((r) => opens.includes(r.level))) {
    const s = opens.length > 1 ? 's' : ''
    return `no course here is a ${levelsText(opens)}, the level${s} your qualification opens`
  }
  return null
}

/**
 * Where a road differs from her answers: each rule she answered that it does not agree with, then
 * her qualification when it shaped the road among `roads`.
 */
function differencesOf(
  answers: StoredAnswers,
  relative: Relative | null,
  spec: RoadKey,
  roads: readonly RoadKey[],
): Difference[] {
  const differences: Difference[] = rulesOf(answers, relative)
    .filter((rule) => !rule.matches(spec))
    .map(({ key, yours, road, because }) => {
      const reason = because?.(spec)
      return { key, yours, road: road(spec), ...(reason && { because: reason }) }
    })
  const noPr = stayNoPr(answers, spec)
  if (noPr) differences.unshift(noPr)
  const qual = qualReason(answers, roads)
  const yours = said(answers, 'qual')
  if (qual && typeof yours === 'string')
    differences.push({ key: 'qual', yours, road: spec.level, because: qual })
  return differences
}

/**
 * Her answers against one road alone (the why reads a road without roadFor's match this way); her
 * qualification is read against every candidate, as matching reads it.
 */
export const differencesFrom = (
  answers: StoredAnswers,
  relative: Relative | null,
  spec: RoadKey,
): Difference[] => differencesOf(answers, relative, spec, ROAD_CANDIDATES)

/**
 * The road nearest her answers, among those her qualification opens: the first of the roads that
 * agree with the most rules, in order, an open-entry course before one that asks a degree. Throws
 * when her qualification leaves no road at all (roadFor then draws the illustrative road).
 */
export function matchRoad(
  answers: StoredAnswers,
  relative: Relative | null,
  roads: readonly RoadKey[] = ROAD_CANDIDATES,
): Match {
  const rules = rulesOf(answers, relative)
  const staying = text(answers, 'stay') === 'Yes'
  // A rule she did not answer matches every road, so it is left out. Then, in a tie, an open-entry
  // course, then (when she said she'd stay) a road with a road to PR.
  const score = (spec: RoadKey): boolean[] => [
    ...rules.map((rule) => rule.matches(spec)),
    openEntry(spec.courseId),
    !(staying && noClearPr(spec)),
  ]
  const beats = (x: boolean[], y: boolean[]): boolean => {
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i]
    return false
  }

  const pool = eligibleRoads(answers, roads)
  if (pool.length === 0) throw new Error('No road at a level her qualification allows')
  let spec = pool[0]
  let best = score(spec)
  for (const candidate of pool.slice(1)) {
    const s = score(candidate)
    if (beats(s, best)) {
      spec = candidate
      best = s
    }
  }

  const differences = differencesOf(answers, relative, spec, roads)
  return { spec, exact: rules.length > 0 && differences.length === 0, differences }
}
