// The one line under each question item on screens 1–4: what her answer does in this preview.
// Ported from the prototype's r5-model.js `impact`, with the copy changed where the prototype
// promises what this slice does not build or names data the mock catalogue does not hold. Pure:
// the screens show it the instant she taps, and nothing on the server differs.

import {
  CAMPUSES,
  CITIES,
  COURSES,
  cityById,
  cityOf,
  minutesBetween,
  placeById,
} from '@/features/engine'
import type { AnswerValue, QuestionKey, Relative, StoredAnswers } from '@/shared/types/student'
import {
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

type LineFn = (answers: StoredAnswers, relative: Relative | null) => string | null

/** Ends a line whose figures come from the mock preview, not from her answers (criterion 3). */
const MOCK = ' · mock'
/** An answer that only adds weight alongside another one: what it does, and no more. */
const SHAPES = 'noted; it shapes what each future is drawn around.'

/** What the assumed value reads as: amounts as "AUD 30k", everything else as itself. */
const assumedText = (key: QuestionKey, value: AnswerValue | undefined): string =>
  key === 'amount' && value !== undefined ? `AUD ${value}k` : display(value)

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

const ENGLISH_MEETING_EVERY_COURSE = ['IELTS 6.5', 'IELTS 7.0', 'IELTS 7.5 or more']

/** The English test speaks first; her last qualification alone is only noted. */
const qualsLine: LineFn = (answers) => {
  const eng = textOf(answers, 'eng')
  if (eng === 'IELTS 6.0') return `IELTS 6.0: some courses ask for 6.5${MOCK}`
  if (eng === 'Not taken yet')
    return 'Not taken yet: routes are marked unconfirmed until you sit it.'
  if (eng !== undefined && ENGLISH_MEETING_EVERY_COURSE.includes(eng)) {
    return `${eng}: meets the English requirement of every course in this preview.`
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
      ? `${listJ(areas)}: courses across them show side by side.`
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

/** Her campuses in the place's city, nearest first, as minutes by road (estimates). */
function relativeLine(relative: Relative): string {
  const who = relative.name ?? `your ${relative.relationship.toLowerCase()}`
  const place = relative.placeId === null ? undefined : placeById(relative.placeId)
  if (!place) {
    return `We'll show distances from ${who} in ${relative.place} once we can work them out.`
  }
  const city = cityById(place.cityId)
  const [first, second] = CAMPUSES.filter((campus) => campus.cityId === city.id)
    .map((campus) => ({ name: campus.name, minutes: minutesBetween(place, campus) }))
    .sort((a, b) => a.minutes - b.minutes)
  const campuses = [
    `${first.name} is about ${first.minutes} min away`,
    ...(second ? [`${second.name} about ${second.minutes} min`] : []),
  ].join(', ')
  const where = place.name === city.name ? place.name : `${place.name}, ${city.name}`
  return `${capital(who)} in ${where}: ${campuses} · estimate. Every route shows its distance from ${who}.`
}

const communityLines = choice('community', {
  Yes: `Yes: ${SHAPES}`,
  'A little': `A little: ${SHAPES}`,
  No: "No: noted; it won't change your futures.",
})

/** The relative speaks once she has said she knows someone and added them. */
const communityLine: LineFn = (answers, relative) =>
  relative && isVisible('knows', answers) && textOf(answers, 'knows') === 'Yes'
    ? relativeLine(relative)
    : communityLines(answers, relative)

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
 * `itemId` is an Item.id from SCREENS; any other id has no line.
 */
export function impactLine(
  itemId: string,
  answers: StoredAnswers,
  relative: Relative | null,
): string | null {
  const item = ITEMS.get(itemId)
  if (!item) return null
  const [unsure] = unsureQuestions(item, answers)
  if (unsure) return notSureLine(unsure.key)
  return LINES[itemId]?.(answers, relative) ?? null
}

export type ImpactKind = 'plain' | 'assume' | 'limit'
export type ImpactView = { text: string; kind: ImpactKind; mock: boolean; chips: string[] }

/** `impactLine` for the screen: the same text, with its kind, the mock tag apart, and chips. */
export function impactView(
  itemId: string,
  answers: StoredAnswers,
  relative: Relative | null,
): ImpactView | null {
  const item = ITEMS.get(itemId)
  const line = impactLine(itemId, answers, relative)
  if (!item || line === null) return null
  const [first, ...others] = unsureQuestions(item, answers)
  const mock = line.endsWith(MOCK)
  const text = mock ? line.slice(0, -MOCK.length) : line
  if (first) {
    const chips = others.map((question) => assumedText(question.key, DEFAULTS[question.key]))
    return { text, kind: 'assume', mock, chips }
  }
  const dep = textOf(answers, 'dep')
  const limited = itemId === 'dep' && (dep === 'Partner' || dep === 'Partner and children')
  return { text, kind: limited ? 'limit' : 'plain', mock, chips: [] }
}
