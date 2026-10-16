// Why a tile is on her road (criteria 15, 16, 19, 20, 64–66). Code decides which tiles get a why,
// which rules chose each one (or, for a city or course beside her roadmap, how it relates to hers), and
// which answers and catalogue facts it may rest on; the model only words them, and every text it
// writes passes whyProblems. The template says the same from the same data, so a card always has
// a why while the model writes, or when it fails. Pure.

import { cityById, cityOf } from '@/features/engine/catalogue'
import type { City, Course } from '@/features/engine/types'
import {
  DRAWN_TO_AREAS,
  NOT_SURE,
  PARTICULAR,
  SUGGEST_ME,
} from '@/features/opening/model/questions'
import type { QuestionKey, Relative, RoadmapTag, StoredAnswers } from '@/shared/types/student'
import { courseById } from '../data/courses'
import { AREA_FIELDS, FIELDS, relatedFields } from '../data/fields'
import { CITY_STATE, occupationsFor } from '../data/occupations'
import { opportunitiesIn } from '../data/opportunities'
import type {
  Occupation,
  Opportunity,
  RoadSpec,
  SlotCopy,
  SlotId,
  StateId,
  Visa,
} from '../data/types'
import { visaById } from '../data/visas'
import { type AnswerLine, answerLines } from './answer-lines'
import { levelsOpenTo } from './eligibility'
import { cityHint, type Difference, differencesFrom, pickedFields } from './match'

/** The tiles her answers decided: never Point A, Australia, the visas on the way, the fork, Point B or a stack. */
export const WHY_SLOTS = [
  'city',
  'alt-city',
  'course',
  'alt-course',
  'stack-course',
  'pr-straight',
  'pr-lane',
  'pr-lane-end',
] as const satisfies readonly SlotId[]
export type WhySlot = (typeof WHY_SLOTS)[number]

export const isWhySlot = (slot: SlotId | null): slot is WhySlot =>
  WHY_SLOTS.includes(slot as WhySlot)

/** The why tiles beside her roadmap on her board, not on it: another city, another course, her stack's course. */
const BESIDE: readonly WhySlot[] = ['alt-city', 'alt-course', 'stack-course']

/** The courses beside her roadmap: her answers did not choose them; they relate to her course. */
type BesideCourse = 'alt-course' | 'stack-course'
const isBesideCourse = (slot: WhySlot): slot is BesideCourse =>
  slot === 'alt-course' || slot === 'stack-course'

/** The heading over a card's why: a tile on her roadmap, or one beside it on her board. */
export const whyTitle = (slot: WhySlot): string =>
  BESIDE.includes(slot) ? 'Why it’s on your board' : 'Why it’s on your roadmap'

export type WhyFact = { id: string; text: string }
/** What the model is given: the tile, her answers by question, what chose it, the catalogue's facts, her tags. */
export type WhyFacts = {
  /** The tile, and whether it is on her roadmap or beside it on her board. */
  tile: { slot: WhySlot; name: string; on: 'roadmap' | 'board' }
  answers: AnswerLine[]
  /** The rules of her match that put the tile on her road, in her words; [] for a tile beside it. */
  chosenBy: string[]
  /** For a tile beside her roadmap only (another city, another course): how it relates to hers. */
  relation?: string[]
  facts: WhyFact[]
  tags: string[]
}

/** Her road's match as the why reads it: where the road differs from her, and her person. */
export type WhyMatch = { differences: readonly Difference[]; relative: Relative | null }

export const WHY_MAX = 600

const MOCK = ' (mock)'

/**
 * The words that rank, recommend or judge one course or city against another (19, 85): never in a
 * why, nor in an Ask answer. A factual comparison ("AUD 3k more in fees") is not among them.
 */
const RANKING = [
  'best',
  'recommended',
  'recommend',
  'top',
  'ranked',
  'number one',
  'better',
  'worse',
  'stronger',
  'weaker',
  'right choice',
]
const RANKING_RES = RANKING.map((word) => ({
  word,
  re: new RegExp(`\\b${word.replaceAll(' ', '\\s+')}\\b`, 'i'),
}))
const NUMBER = /\d+(?:\.\d+)?/g

/** The wording of the options a why never repeats (66); her fields and scores are facts it may name. */
const OPTION_WORDING = [PARTICULAR, DRAWN_TO_AREAS, SUGGEST_ME, NOT_SURE]

// A figure spelled out ("five years", "thirty-three thousand") is read as its number, so the check
// sees it as it sees digits. "One" alone is left out: it is mostly not a figure ("one of", "no one").
const UNITS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
}
const TEENS: Record<string, number> = {
  zero: 0,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
}
const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
}
const SCALES: Record<string, number> = { hundred: 100, thousand: 1000, million: 1_000_000 }
const words = (o: Record<string, number>) => Object.keys(o).join('|')
const SPELLED = new RegExp(
  `\\b(?:(${words(TENS)})(?:[-\\s](${words(UNITS)}))?|(${words(TEENS)}|${words(UNITS)}))(?:\\s+(${words(SCALES)}))?\\b`,
  'gi',
)

/** The ranking words a text uses. */
export const rankingWords = (text: string): string[] =>
  RANKING_RES.filter(({ re }) => re.test(text)).map(({ word }) => word)

const lowerFirst = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1)

const OPPORTUNITY_KIND: Record<Opportunity['kind'], string> = {
  placement: 'a placement',
  'part-time': 'a part-time job',
  'graduate-program': 'a graduate program',
}

const listsText = (lists: readonly string[]): string =>
  `${lists.join(' and ')} ${lists.length > 1 ? 'lists' : 'list'}`

function listFact(occupation: Occupation, state: StateId): WhyFact {
  const lists = occupation.lists[state] ?? []
  const text =
    lists.length === 0
      ? `${occupation.name} is on no ${state} list`
      : `${occupation.name} is on ${state}'s ${listsText(lists)}`
  return { id: `list-${occupation.code}-${state}`, text }
}

function sponsorFact(occupation: Occupation): WhyFact[] {
  if (!occupation.employerSponsored) return []
  return [
    {
      id: `sponsored-${occupation.code}`,
      text: `${occupation.name} can be sponsored by an employer`,
    },
  ]
}

const roadState = (spec: RoadSpec): StateId => CITY_STATE[spec.cityId]
/** The state a course is taught in: its list status is read there, wherever the road is. */
const courseState = (course: Course): StateId => CITY_STATE[cityOf(course).id]

const courseIdOf = (spec: RoadSpec, slot: 'course' | BesideCourse): string =>
  slot === 'course' ? spec.courseId : slot === 'alt-course' ? spec.altCourseId : spec.stackCourseId

const opportunityLine = (o: Opportunity): WhyFact => ({
  id: `opportunity-${o.id}`,
  text: `${o.title} at ${o.employer}, ${OPPORTUNITY_KIND[o.kind]} in ${cityById(o.cityId).name}`,
})

/**
 * A course's fees, years, occupations and their lists in its own state, and opportunities there.
 * Without `lists` (a course tile on a road with no way to PR) the occupations stay and their
 * lists go: beside the fork, a list would read as a way to PR.
 */
function courseLines(courseId: string, lists = true): WhyFact[] {
  const course = courseById(courseId)
  if (!course) return []
  const named = `${course.name} at ${course.university}`
  const occupations = occupationsFor(course.id)
  return [
    { id: 'course-fees', text: `${named}: fees about AUD ${course.feeK}k a year` },
    { id: 'course-years', text: `${named} takes ${course.years} years` },
    ...occupations.flatMap((o) => [
      { id: `occupation-${o.code}`, text: `${named} leads to ${o.name}` },
      ...(lists ? [listFact(o, courseState(course))] : []),
    ]),
    ...opportunitiesIn(cityOf(course).id, course.field).map(opportunityLine),
  ]
}

// Ask's rows carry "(mock)" on each text; a why's facts do not, as the card's mock tag says it.
const mocked = (f: WhyFact): WhyFact => ({ ...f, text: `${f.text}${MOCK}` })

/** Ask's rows for a course: its facts, each labelled mock. */
export const courseFacts = (courseId: string): WhyFact[] => courseLines(courseId).map(mocked)

/** Ask's row for an opportunity, labelled mock. */
export const opportunityFact = (o: Opportunity): WhyFact => mocked(opportunityLine(o))

const livingFact = (city: City): WhyFact => ({
  id: 'city-living',
  text: `Living costs in ${city.name} about AUD ${city.livingK}k a year`,
})

/**
 * A city's living cost, whether it counts as regional, and the state's lists for her course's
 * occupations; on a road with no way to PR (no clear road to it, or a road home) no list, which
 * beside its fork would read as one.
 */
function cityFacts(spec: RoadSpec, cityId: string): WhyFact[] {
  const city = cityById(cityId)
  const state = CITY_STATE[city.id]
  return [
    livingFact(city),
    {
      id: 'city-regional',
      text: city.regional
        ? `${city.name} counts as regional for visas`
        : `${city.name} does not count as regional for visas`,
    },
    ...(spec.prRoute === 'none'
      ? []
      : occupationsFor(spec.courseId).map((o) => listFact(o, state))),
  ]
}

/** The visa a way-to-stay tile is about, as its slot names it (the 485 on a road home's tiles). */
function visaOf(copy: SlotCopy): Visa {
  if (!copy.visa) throw new Error(`Way-to-stay tile "${copy.id}" names no visa`)
  return visaById(copy.visa)
}

function prFacts(spec: RoadSpec, copy: SlotCopy): WhyFact[] {
  const visa = visaOf(copy)
  const occupations = occupationsFor(spec.courseId)
  return [
    ...visa.conditions.map((condition, i) => ({
      id: `visa-${visa.id}-${i + 1}`,
      text: `Subclass ${visa.id}: ${condition}`,
    })),
    ...occupations.flatMap((o) => [listFact(o, roadState(spec)), ...sponsorFact(o)]),
  ]
}

function factsFor(spec: RoadSpec, slot: WhySlot): WhyFact[] {
  switch (slot) {
    case 'city':
      return cityFacts(spec, spec.cityId)
    case 'alt-city':
      return cityFacts(spec, spec.altCityId)
    case 'course':
    case 'alt-course':
    case 'stack-course':
      return courseLines(courseIdOf(spec, slot), spec.prRoute !== 'none')
    default:
      return prFacts(spec, spec.slots[slot])
  }
}

// ── What chose the tile (64) ─────────────────────────────────────────────────────────────────

/** What she said: an answer stored as assumed reads as unanswered, as the matcher reads it. */
const said = (answers: StoredAnswers, key: QuestionKey) => {
  const answer = answers[key]
  return answer?.state === 'stated' ? answer.value : undefined
}

const STAY_REASON: Readonly<Record<string, string>> = {
  Yes: "you said you'd stay",
  [NOT_SURE]: 'you said you might stay',
  No: "you said you'd go home",
}

function stayReason(answers: StoredAnswers, differs: ReadonlySet<string>): string[] {
  const stay = said(answers, 'stay')
  const reason = typeof stay === 'string' ? STAY_REASON[stay] : undefined
  return reason && !differs.has('stay') ? [reason] : []
}

/** The field or area she picked that reaches the road's field. */
function fieldReason(spec: RoadSpec, answers: StoredAnswers, differs: ReadonlySet<string>) {
  if (!pickedFields(answers)?.includes(spec.field)) return []
  if (differs.has('field') || differs.has('areas')) return []
  const areas = said(answers, 'areas')
  const area =
    said(answers, 'know') === DRAWN_TO_AREAS && Array.isArray(areas)
      ? areas.find((a) => AREA_FIELDS[a]?.includes(spec.field))
      : undefined
  return [`you picked ${area ?? String(said(answers, 'field'))}`]
}

/** The level she chose, and the level her last qualification opens (eligibility.ts). */
function levelReasons(spec: RoadSpec, answers: StoredAnswers, differs: ReadonlySet<string>) {
  const reasons: string[] = []
  if (said(answers, 'level') === spec.level && !differs.has('level'))
    reasons.push(`you chose ${spec.level}`)
  if (levelsOpenTo(answers)?.includes(spec.level))
    reasons.push(`your last qualification opens ${spec.level}`)
  return reasons
}

/**
 * The city hint that chose the road's city, with its source, as the matcher defines it (match.ts).
 * None when she gave no hint or the road's city differs from it.
 */
function hintReason(
  spec: RoadSpec,
  answers: StoredAnswers,
  { differences, relative }: WhyMatch,
): string[] {
  if (differences.some((d) => d.key === 'place')) return []
  const hint = cityHint(answers, relative)
  return hint ? [`${cityById(spec.cityId).name}: ${hint.chose}`] : []
}

/**
 * The rules of her match that put a tile on her road: city tiles stay and hint, a course field and
 * level, PR stay. None for a tile beside it: the skeleton or the catalogue chose those.
 */
function chosenByOf(
  spec: RoadSpec,
  slot: WhySlot,
  answers: StoredAnswers,
  match: WhyMatch,
): string[] {
  const differs = new Set(match.differences.map((d) => d.key))
  switch (slot) {
    case 'city':
      return [...stayReason(answers, differs), ...hintReason(spec, answers, match)]
    case 'course':
      return [...fieldReason(spec, answers, differs), ...levelReasons(spec, answers, differs)]
    case 'alt-city':
    case 'alt-course':
    case 'stack-course':
      return []
    default:
      // A staying road with no clear road to PR: her stay answer did not choose its steps home.
      return spec.stays && spec.prRoute === 'none' ? [] : stayReason(answers, differs)
  }
}

/** Without roadFor's match: her answers against this road alone, and no person. */
const ownMatch = (spec: RoadSpec, answers: StoredAnswers): WhyMatch => ({
  differences: differencesFrom(answers, null, spec),
  relative: null,
})

// ── How a course beside her roadmap relates to hers (65) ─────────────────────────────────────

const fieldWords = (id: string): string => lowerFirst(FIELDS.find((f) => f.id === id)?.name ?? id)

function fieldRelation(other: string, hers: string): string[] {
  if (other === hers) return [`the same field as yours, ${fieldWords(hers)}`]
  return relatedFields(hers).includes(other)
    ? [`${fieldWords(other)} is related to ${fieldWords(hers)}`]
    : []
}

function feeRelation(moreK: number): string {
  const k = Math.round(Math.abs(moreK) * 10) / 10
  if (k === 0) return 'the same fees a year'
  return `AUD ${k}k a year ${moreK > 0 ? 'more' : 'less'} in fees`
}

/** Whether the course's occupation is on the road's way to stay too; nothing on a road home. */
function prRelation(spec: RoadSpec, course: Course): string[] {
  const occupation = occupationsFor(course.id)[0]
  if (spec.prRoute === 'none' || !occupation) return []
  if (spec.prRoute === '186' && occupation.employerSponsored)
    return ['its occupation can be sponsored by an employer too']
  const state = courseState(course)
  const lists = occupation.lists[state] ?? []
  if (spec.prRoute !== '186' && lists.includes(spec.prRoute))
    return [`its occupation is on ${state}'s ${spec.prRoute} list too`]
  return [
    lists.length === 0
      ? `its occupation is on no ${state} list`
      : `its occupation is on ${state}'s ${listsText(lists)}`,
  ]
}

/** Where the course is taught, its field beside hers, the fees and the way to stay, against her course. */
function relationOf(spec: RoadSpec, slot: BesideCourse): string[] {
  const hers = courseById(spec.courseId)
  const other = courseById(courseIdOf(spec, slot))
  if (!hers || !other) return []
  const city = cityOf(other)
  return [
    city.id === cityOf(hers).id ? `another course in ${city.name}` : `a course in ${city.name}`,
    ...fieldRelation(other.field, hers.field),
    feeRelation(other.feeK - hers.feeK),
    ...prRelation(spec, other),
  ]
}

/** Whether the other city counts as regional, beside hers, in words that read one way only. */
function regionalRelation(other: City, hers: City): string {
  const counts = (c: City) => (c.regional ? 'counts' : 'does not count')
  const same = hers.regional ? 'so does' : 'neither does'
  return other.regional === hers.regional
    ? `${other.name} ${counts(other)} as regional for visas; ${same} ${hers.name}`
    : `${other.name} ${counts(other)} as regional for visas; ${hers.name} ${hers.regional ? 'does' : 'does not'}`
}

function livingRelation(moreK: number): string {
  const k = Math.round(Math.abs(moreK) * 10) / 10
  if (k === 0) return 'the same living costs a year'
  return `AUD ${k}k a year ${moreK > 0 ? 'more' : 'less'} in living costs`
}

/** The other city on her board, against hers: the skeleton put it there, not her answers. */
function cityRelation(spec: RoadSpec): string[] {
  const hers = cityById(spec.cityId)
  const other = cityById(spec.altCityId)
  return [
    `the other city on your board, beside ${hers.name}`,
    regionalRelation(other, hers),
    livingRelation(other.livingK - hers.livingK),
  ]
}

/** How a tile beside her roadmap relates to hers; undefined for a tile on it. */
function relationFor(spec: RoadSpec, slot: WhySlot): string[] | undefined {
  if (slot === 'alt-city') return cityRelation(spec)
  return isBesideCourse(slot) ? relationOf(spec, slot) : undefined
}

/**
 * The tile, her answers, what chose it (or how a tile beside her roadmap relates to hers), the
 * catalogue's facts and her tags. A wellbeing tag never reaches the model (ADR-088: those are for
 * support content only). Without roadFor's match, the road is read against her answers alone.
 */
export function whyFacts(
  spec: RoadSpec,
  slot: WhySlot,
  answers: StoredAnswers,
  tags: readonly RoadmapTag[],
  match: WhyMatch = ownMatch(spec, answers),
): WhyFacts {
  const relation = relationFor(spec, slot)
  return {
    tile: { slot, name: spec.slots[slot].name, on: BESIDE.includes(slot) ? 'board' : 'roadmap' },
    answers: answerLines(answers),
    chosenBy: chosenByOf(spec, slot, answers, match),
    ...(relation && { relation }),
    facts: factsFor(spec, slot),
    tags: tags.filter((t) => !t.wellbeing).map((t) => t.text),
  }
}

/** The one catalogue line the template rests on, from the same facts the model is given. */
function factLine(spec: RoadSpec, slot: WhySlot): string {
  // The other city's relation already weighs its regional status and living costs against hers,
  // so its line is a list there; on a road with no way to PR, which has no list, its living cost.
  const altList = occupationsFor(spec.courseId)[0]
  if (slot === 'alt-city' && altList) {
    return spec.prRoute === 'none'
      ? livingFact(cityById(spec.altCityId)).text
      : listFact(altList, CITY_STATE[spec.altCityId]).text
  }
  if (slot === 'city' || slot === 'alt-city') {
    const city = cityById(slot === 'city' ? spec.cityId : spec.altCityId)
    const regional = city.regional ? 'counts as regional for visas' : 'is not regional for visas'
    return `${city.name} ${regional}; living costs about AUD ${city.livingK}k a year`
  }
  if (slot === 'course' || isBesideCourse(slot)) {
    const course = courseById(courseIdOf(spec, slot))
    if (!course) return spec.slots[slot].name
    const named = `${course.name} at ${course.university}`
    const occupation = occupationsFor(course.id)[0]
    if (!occupation) return `${named}: fees about AUD ${course.feeK}k a year`
    const state = courseState(course)
    const lists = occupation.lists[state] ?? []
    const route = lists.find((l) => l === spec.prRoute)
    const on = route ? [route] : lists
    // On a road with no way to PR the occupation stays and its lists go, as in its facts.
    if (on.length === 0 || spec.prRoute === 'none') return `${named} leads to ${occupation.name}`
    return `${named} leads to ${occupation.name}, on ${state}'s ${listsText(on)}`
  }
  const tile = spec.slots[slot]
  const visa = visaOf(tile)
  return `${tile.name}: ${lowerFirst(visa.conditions[0])}`
}

/**
 * A why from the same data alone: what the card shows until the model's arrives. A tile on her
 * roadmap names the rules that chose it, a course beside it how it relates to hers, then one
 * catalogue line.
 */
export function whyTemplate(
  spec: RoadSpec,
  slot: WhySlot,
  answers: StoredAnswers,
  match: WhyMatch = ownMatch(spec, answers),
): string {
  const reasons = relationFor(spec, slot) ?? chosenByOf(spec, slot, answers, match)
  const fact = factLine(spec, slot)
  const where = BESIDE.includes(slot) ? 'Beside your roadmap' : 'On your roadmap'
  return reasons.length > 0 ? `${where}: ${reasons.join('; ')}. ${fact}.` : `${where}: ${fact}.`
}

/** The figures spelled out in a text, as digits; a lone "one" is not one. */
function spelledIn(text: string): string[] {
  return [...text.matchAll(SPELLED)].flatMap(([, tens, unit, small, scale]) => {
    const lower = (s: string | undefined) => s?.toLowerCase() ?? ''
    if (lower(small) === 'one' && !scale) return []
    const base = tens
      ? TENS[lower(tens)] + (unit ? UNITS[lower(unit)] : 0)
      : (TEENS[lower(small)] ?? UNITS[lower(small)])
    return [String(scale ? base * SCALES[lower(scale)] : base)]
  })
}

export const numbersIn = (text: string): string[] => [
  ...(text.match(NUMBER) ?? []),
  ...spelledIn(text),
]

/** The sentences of a text that give a reason ("because …"). */
const becauseSentences = (text: string): string[] =>
  text.split(/(?<=[.!?])\s+/).filter((s) => /\bbecause\b/i.test(s))

/** Every problem in a why, one line each, for the model to fix; [] when it may be shown. */
export function whyProblems(text: string, data: WhyFacts, used: string[]): string[] {
  const problems: string[] = []
  if (text.trim() === '') problems.push('why: write two or three sentences.')
  if (text.length > WHY_MAX) problems.push(`why: at most ${WHY_MAX} characters.`)
  for (const word of rankingWords(text)) {
    problems.push(`why: never say "${word}"; nothing is ranked or recommended.`)
  }
  const known = new Set(
    [
      ...data.facts.map((f) => f.text),
      ...data.answers.map((a) => a.answer),
      ...data.chosenBy,
      ...(data.relation ?? []),
    ].flatMap(numbersIn),
  )
  for (const n of new Set(numbersIn(text))) {
    if (!known.has(n))
      problems.push(`why: ${n} is in no fact and no answer; use only their figures.`)
  }
  const ids = new Set(data.facts.map((f) => f.id))
  for (const id of used) {
    if (!ids.has(id)) problems.push(`used: "${id}" is not an id in DATA.facts.`)
  }
  if (/\(mock\)/i.test(text))
    problems.push('why: never write "(mock)"; the card already says its figures are mock.')
  const lower = text.toLowerCase()
  for (const option of OPTION_WORDING) {
    if (lower.includes(option.toLowerCase()))
      problems.push(`why: never repeat the option "${option}"; say what it meant in your words.`)
  }
  const reasons = becauseSentences(text).map((s) => s.toLowerCase())
  for (const tag of data.tags) {
    if (reasons.some((s) => s.includes(tag.toLowerCase())))
      problems.push(
        `why: her tag "${tag}" is never the reason; say why from DATA.chosenBy or DATA.relation.`,
      )
  }
  return problems
}
