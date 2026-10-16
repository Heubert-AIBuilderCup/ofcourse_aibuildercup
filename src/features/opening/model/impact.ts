// The one line under each question item on screens 1–4: what her answer does in this preview.
// Ported from the prototype's r5-model.js `impact`, with the copy changed where the prototype
// promises what this slice does not build or names data the mock catalogue does not hold. Pure:
// the screens show it the instant she taps, and nothing on the server differs. The courses' English
// scores come in as data from the page (the roads' catalogue holds them; the opening loads nothing
// of the roads).

import {
  CAMPUSES,
  CITIES,
  COURSES,
  cityById,
  cityOf,
  minutesBetween,
  placeById,
  placeLabel,
  whoOf,
} from '@/features/engine'
import {
  type AnswerValue,
  hasPlace,
  type QuestionKey,
  type Relative,
  type StoredAnswers,
} from '@/shared/types/student'
import { ieltsEquivalent, NOT_TAKEN, parseEnglish } from './english'
import { PERSON } from './onboarding'
import {
  activeRelative,
  DEFAULTS,
  DRAWN_TO_AREAS,
  display,
  effective,
  type Item,
  isVisible,
  PARTICULAR,
  type Question,
  SCREENS,
  SUGGEST_ME,
} from './questions'

/** The overall IELTS score each course in the preview asks for, one per course. */
export type EnglishScores = readonly number[]

type LineFn = (
  answers: StoredAnswers,
  relative: Relative | null,
  scores: EnglishScores,
) => string | null

/** Ends a line whose figures come from the mock preview, not from her answers (criterion 3). */
const MOCK = ' · mock'
/** An answer that only adds weight alongside another one: what it does, and no more. */
const SHAPES = 'noted; it shapes what each future is drawn around.'

/** What the assumed value reads as: amounts as "AUD 30k", no field as "any field", else itself. */
const assumedText = (key: QuestionKey, value: AnswerValue | undefined): string => {
  if (key === 'amount' && value !== undefined) return `AUD ${value}k`
  return key === 'field' ? 'any field' : display(value)
}

/** The line for a question she answered "Not sure": what is assumed, and that she can change it. */
export function notSureLine(key: QuestionKey): string {
  return `Not sure: I'll assume “${assumedText(key, DEFAULTS[key])}” and show it as a chip you can change.`
}

const ITEMS = new Map(SCREENS.flatMap((screen) => screen.items).map((item) => [item.id, item]))

const listJ = (items: readonly string[]): string =>
  items.length <= 1
    ? items.join('')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

/** A string answer; undefined when unanswered (or a number or a list). */
function textOf(answers: StoredAnswers, key: QuestionKey): string | undefined {
  const value = answers[key]?.value
  return typeof value === 'string' ? value : undefined
}

/** The line for the option she picked, by the table; null for a value the table does not know. */
const choice =
  (key: QuestionKey, lines: Readonly<Record<string, string>>): LineFn =>
  (answers) => {
    const value = textOf(answers, key)
    return value !== undefined && Object.hasOwn(lines, value) ? lines[value] : null
  }

// ── Budget ──────────────────────────────────────────────────────────────────────────────────

/** A rough budget stretches this far (AUD thousands) before a city is out of reach. */
const STRETCH_K = 6

/** Each city with its cheapest course fee, dearest first. */
const CITY_FEES = CITIES.map((city) => ({
  name: city.name,
  feeK: Math.min(...COURSES.filter((course) => cityOf(course).id === city.id).map((c) => c.feeK)),
})).sort((a, b) => b.feeK - a.feeK)

const namesWhere = (test: (feeK: number) => boolean): string[] =>
  CITY_FEES.filter((city) => test(city.feeK)).map((city) => city.name)

const budgetLine: LineFn = (answers) => {
  if (answers.hard === undefined) {
    const amount = answers.amount?.value
    if (typeof amount === 'number') {
      return `About AUD ${amount}k a year. Tell me if it's a hard limit.`
    }
    return answers.covers || answers.who
      ? "Add an amount and I'll show which cities stay open."
      : null
  }
  const limit = effective(answers, 'amount')
  if (typeof limit !== 'number') return null
  const stay = (cities: readonly string[]) => (cities.length > 1 ? 'stay' : 'stays')

  if (answers.hard.value === 'Hard limit') {
    const sealed = namesWhere((feeK) => feeK > limit)
    const kept = namesWhere((feeK) => feeK <= limit).slice(0, 2)
    const seals = sealed.length
      ? `${listJ(sealed)} ${sealed.length > 1 ? 'seal' : 'seals'}`
      : 'nothing seals'
    const open = kept.length
      ? `${listJ(kept)} ${stay(kept)} open.`
      : 'nothing in this preview fits yet.'
    return `Hard limit at ${limit}k: ${seals}; ${open}`
  }
  const stretch = namesWhere((feeK) => feeK > limit && feeK <= limit + STRETCH_K)
  const open = stretch.length
    ? `${listJ(stretch)} ${stay(stretch)} open, marked as a stretch.`
    : `everything up to about ${limit + STRETCH_K}k stays open.`
  return `Roughly ${limit}k: ${open}`
}

// ── Timing, scores, study ───────────────────────────────────────────────────────────────────

/** The mock count of intakes open by the latest start she would accept. */
const INTAKES: Readonly<Record<string, number>> = {
  'Feb 2027': 3,
  'Jul 2027': 5,
  'Feb 2028': 7,
}

/**
 * Until the latest start is answered: what the earliest start and the most years already say,
 * both named when both are answered.
 */
function beforeLatestLine(answers: StoredAnswers): string | null {
  const earliest = textOf(answers, 'earliest')
  const years = textOf(answers, 'years')
  const most = years === '4 or more' ? '4 or more years' : `up to ${years} years`
  if (earliest !== undefined) {
    const from = earliest === 'Later' ? 'Later is fine' : `From ${earliest}`
    const both = years === undefined ? from : `${from}, ${most}`
    return `${both}. Tell me the latest you'd accept.`
  }
  if (years === undefined) return null
  return years === '4 or more'
    ? '4 or more years: every course length stays open.'
    : `Up to ${years} years: longer courses stay out.`
}

const timingLine: LineFn = (answers) => {
  const latest = textOf(answers, 'latest')
  if (latest === undefined) return beforeLatestLine(answers)
  if (!Object.hasOwn(INTAKES, latest)) return null
  const note =
    textOf(answers, 'years') === '2' ? '. Two years at most: 18-month and 2-year courses only' : ''
  return `Latest ${latest}: ${INTAKES[latest]} intakes open${note}${MOCK}`
}

/** The quick option above the stored scores: read as its floor. */
const IELTS_OR_MORE = 'IELTS 7.5 or more'

/** How many courses a score meets, by each course's own entry score. */
function reachText(ielts: number, scores: EnglishScores): string {
  const meets = scores.filter((score) => ielts >= score).length
  if (meets === scores.length) return 'meets the English score of every course in this preview'
  if (meets === 0) return 'below the English score of every course in this preview'
  return `meets the English score of ${meets} of the ${scores.length} courses in this preview`
}

/** The English test speaks first; her last qualification alone is only noted. */
const qualsLine: LineFn = (answers, _relative, scores) => {
  const eng = textOf(answers, 'eng')
  if (eng === NOT_TAKEN) return 'Not taken yet: routes are marked unconfirmed until you sit it.'
  if (eng === IELTS_OR_MORE) return `${eng}: ${reachText(7.5, scores)}${MOCK}`
  const exact = eng === undefined ? null : parseEnglish(eng)
  if (eng !== undefined && exact) {
    const ielts = ieltsEquivalent(exact)
    const reach = reachText(ielts, scores)
    return exact.test === 'IELTS'
      ? `${eng}: ${reach}${MOCK}`
      : `${eng}: about IELTS ${ielts.toFixed(1)}, which ${reach.replace(/^below/, 'is below')}${MOCK}`
  }
  const qual = textOf(answers, 'qual')
  return qual === undefined ? null : `${qual}: noted for entry requirements.`
}

const knowLine: LineFn = (answers) => {
  const know = textOf(answers, 'know')
  if (know === SUGGEST_ME) {
    return "Suggest me: we'll start wide, with futures from every field in this preview."
  }
  if (know === PARTICULAR) {
    const field = textOf(answers, 'field')
    return field === undefined
      ? 'Particular: pick the field.'
      : `Particular: your futures use ${field} courses; you can change the field on each one.`
  }
  if (know === DRAWN_TO_AREAS) {
    const areas = answers.areas?.value
    return Array.isArray(areas) && areas.length > 0
      ? `${areas.join(' · ')}: courses across them show side by side.`
      : 'Pick up to three areas.'
  }
  return null
}

// ── Where and how she would live ────────────────────────────────────────────────────────────

const whereLine: LineFn = (answers) => {
  const where = textOf(answers, 'where')
  if (where === undefined) return null
  if (where === 'Australia (on a visa)') {
    return "In Australia: you may apply onshore · your current visa's conditions still apply"
  }
  if (where === 'Another country') {
    return "Another country: we'll check the visa rules for where you are · study fees apply"
  }
  return `${where}: visa required · study fees apply`
}

const destLine: LineFn = (answers) => {
  const dest = textOf(answers, 'dest')
  if (dest === 'Australia') return `Australia: ${CITIES.length} cities in this preview${MOCK}`
  if (dest === 'Open to others') {
    return 'Only Australia is covered in this preview, so your futures will be Australian.'
  }
  return null
}

/** A line in two parts around its tag: what comes before, and the tag with what goes on after it. */
type LineParts = { text: string; tag: ImpactTag | null }

/**
 * The line on her person (criterion 10), in parts, so the tag is never searched for in text she
 * typed: with a place in the preview, her campuses in its city, nearest first, as minutes by road
 * (estimates); with "Somewhere else", a promise; with no place, a request for one. Null with no person.
 */
function personParts(relative: Relative | null): LineParts | null {
  if (!relative) return null
  const who = whoOf(relative)
  if (!hasPlace(relative)) {
    return {
      text: `Pick a city or suburb, and each route shows its distance from ${who}.`,
      tag: null,
    }
  }
  const place = relative.placeId === null ? undefined : placeById(relative.placeId)
  if (!place) {
    const where = relative.place ? ` in ${relative.place}` : ''
    return {
      text: `We'll show distances from ${who}${where} once we can work them out.`,
      tag: null,
    }
  }
  const city = cityById(place.cityId)
  const [first, second] = CAMPUSES.filter((campus) => campus.cityId === city.id)
    .map((campus) => ({ name: campus.name, minutes: minutesBetween(place, campus) }))
    .sort((a, b) => a.minutes - b.minutes)
  const campuses = [
    `${first.name} is about ${first.minutes} min away`,
    ...(second ? [`${second.name} about ${second.minutes} min`] : []),
  ].join(', ')
  return {
    text: `${capital(who)} in ${placeLabel(place)}: ${campuses}`,
    tag: { text: 'estimate', after: `. Every route shows its distance from ${who}.` },
  }
}

/** The line on her person as one string; see `personParts`. */
export function personLine(relative: Relative | null): string | null {
  const parts = personParts(relative)
  return parts && (parts.tag ? `${parts.text} · ${parts.tag.text}${parts.tag.after}` : parts.text)
}

const communityLine = choice('community', {
  Yes: `Yes: ${SHAPES}`,
  'A little': `A little: ${SHAPES}`,
  No: "No: noted; it won't change your futures.",
})

/** After a Yes, her person speaks once they have a place; until then, the line asks for them. */
const knowsLine: LineFn = (answers, relative) => {
  const knows = textOf(answers, 'knows')
  if (knows === 'No') return "No: noted; it won't change your futures."
  if (knows !== 'Yes') return null
  const person = activeRelative(answers, relative)
  return person && hasPlace(person)
    ? personLine(person)
    : 'Yes: next, tell me who and where. Every route can then show its distance from them.'
}

const climateLine: LineFn = (answers) => {
  const climate = textOf(answers, 'climate')
  return climate === undefined
    ? null
    : `${climate}: noted; climate doesn't change your futures in this preview.`
}

const settleLine: LineFn = (answers) => {
  const settle = textOf(answers, 'settle')
  return settle === undefined ? null : `${settle}: noted; it shapes what we show you later.`
}

/** One entry per Item.id in SCREENS. */
const LINES: Readonly<Record<string, LineFn>> = {
  where: whereLine,
  budget: budgetLine,
  timing: timingLine,
  dep: choice('dep', {
    'No one': 'Just you: single living costs on every route.',
    Partner: "Family isn't covered in this preview yet, so every route shows costs for you alone.",
    'Partner and children':
      "Family isn't covered in this preview yet, so every route shows costs for you alone.",
  }),
  quals: qualsLine,
  know: knowLine,
  level: choice('level', {
    Diploma: `Diploma: 1–2 years; some give credit towards a bachelor's${MOCK}`,
    "Bachelor's": `Bachelor's: 3 years; a second degree at your level${MOCK}`,
    "Master's": `Master's: 18 months to 2 years, building on your degree${MOCK}`,
  }),
  learn: choice('learn', {
    'Hands-on with placements': `Placements: ${SHAPES}`,
    'Mostly classroom and research':
      "Classroom and research: noted; it doesn't change your futures in this preview.",
    'No preference': "No preference: placements shown, but they don't move anything.",
  }),
  length: choice('length', {
    'As short as possible': `Short: ${SHAPES} 18-month courses can lose the 2-year work-rights bonus${MOCK}`,
    'Fine with longer if it opens more': `Longer is fine: 2-year courses keep full post-study work rights${MOCK}`,
  }),
  dest: destLine,
  place: choice('place', {
    City: 'City: more part-time jobs and bigger markets; higher rent, no regional points.',
    Suburban: 'Suburban: rent between the two; usually still metro for migration.',
    Regional: 'Regional: more PR points, cheaper rent, fewer part-time jobs.',
  }),
  community: communityLine,
  knows: knowsLine,
  climate: climateLine,
  stay: choice('stay', {
    Yes: 'Yes: courses off the occupation list seal; regional study gains points.',
    'Not sure': 'Not sure: PR counts, but no route seals.',
    No: 'No: PR stops counting in your futures.',
  }),
  focus: choice('focus', {
    'Career-focused': 'Career-focused: your futures weigh career heavily.',
    Academic: 'Academic: your futures weigh career lightly.',
  }),
  earn: choice('earn', {
    Yes: 'Yes: your futures weigh work heavily; part-time rules shown on every route.',
    Helpful: 'Helpful: part-time rules shown on every route.',
    No: 'No: your futures weigh work lightly.',
  }),
  settle: settleLine,
}

/** The item's visible questions she answered "Not sure", in the item's order. */
function unsureQuestions(item: Item, answers: StoredAnswers): Question[] {
  // A Not sure on a question she is no longer shown (the field after "Suggest me") stays quiet.
  return item.questions.filter(
    (question) =>
      question.notSure &&
      isVisible(question.key, answers) &&
      answers[question.key]?.state === 'assumed',
  )
}

/**
 * The one line under an item, or null when nothing in it is answered yet. A question she
 * answered "Not sure" (the first one, in the item's order) takes the line for the whole item.
 * `itemId` is an Item.id from SCREENS, or PERSON (step 03's "Who, and where?": her person line);
 * any other id has no line. `scores` are the courses' English scores, for the English line.
 */
export function impactLine(
  itemId: string,
  answers: StoredAnswers,
  relative: Relative | null,
  scores: EnglishScores,
): string | null {
  if (itemId === PERSON) return personLine(relative)
  const item = ITEMS.get(itemId)
  if (!item) return null
  const [unsure] = unsureQuestions(item, answers)
  if (unsure) return notSureLine(unsure.key)
  return LINES[itemId]?.(answers, relative, scores) ?? null
}

export type ImpactKind = 'plain' | 'assume' | 'limit'
/**
 * A line's tag, shown apart: the line reads `text`, " · ", the tag, then `after` (a mock line
 * ends at its tag; an estimate goes on: ". Every route shows its distance from …").
 */
export type ImpactTag = { text: 'mock' | 'estimate'; after: string }
export type ImpactView = { text: string; kind: ImpactKind; tag: ImpactTag | null; chips: string[] }

/** A line that ends at its mock tag, split there; any other line has none (the estimate tag comes from `personParts`). */
function splitMock(line: string): LineParts {
  return line.endsWith(MOCK)
    ? { text: line.slice(0, -MOCK.length), tag: { text: 'mock', after: '' } }
    : { text: line, tag: null }
}

/**
 * The person whose line this item shows (the person screen's own, or "Do you know anyone…" once
 * she said Yes), else null. Mirrors `knowsLine`.
 */
function personShown(
  itemId: string,
  answers: StoredAnswers,
  relative: Relative | null,
): Relative | null {
  if (itemId === PERSON) return relative
  if (itemId !== 'knows' || textOf(answers, 'knows') !== 'Yes') return null
  const person = activeRelative(answers, relative)
  return person && hasPlace(person) ? person : null
}

/** An answer the preview cannot follow: said in the calm limit style. */
function isLimit(itemId: string, answers: StoredAnswers): boolean {
  const dep = textOf(answers, 'dep')
  if (itemId === 'dep') return dep === 'Partner' || dep === 'Partner and children'
  return itemId === 'dest' && textOf(answers, 'dest') === 'Open to others'
}

/** `impactLine` for the screen: the same text, with its kind, its tag apart, and chips. */
export function impactView(
  itemId: string,
  answers: StoredAnswers,
  relative: Relative | null,
  scores: EnglishScores,
): ImpactView | null {
  const line = impactLine(itemId, answers, relative, scores)
  if (line === null) return null
  const item = ITEMS.get(itemId)
  const [first, ...others] = item ? unsureQuestions(item, answers) : []
  const { text, tag } =
    (!first && personParts(personShown(itemId, answers, relative))) || splitMock(line)
  if (first) {
    const chips = others.map((question) => assumedText(question.key, DEFAULTS[question.key]))
    return { text, kind: 'assume', tag, chips }
  }
  return { text, kind: isLimit(itemId, answers) ? 'limit' : 'plain', tag, chips: [] }
}
