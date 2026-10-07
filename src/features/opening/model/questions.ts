// The one definition of opening screens 1–4: their questions, options, DS-D1 defaults, which
// questions show, and how each answer reads as a chip on the futures. Pure, so the screens, the
// engine, the chip editor and the server actions all read the same rules.

import {
  type AnswerValue,
  type OpeningStep,
  type QuestionKey,
  type Relative,
  type StoredAnswer,
  type StoredAnswers,
  storedAnswerSchema,
} from '@/shared/types/student'

export const NOT_SURE = 'Not sure'

export type Question = {
  key: QuestionKey
  /** Shown above the options; empty when the item's title already asks it. */
  label: string
  /** amount: numbers (AUD thousands), displayed "AUD 30k". */
  options: readonly AnswerValue[]
  /** 'select' for where; 'multi' for areas (up to three). */
  control: 'chips' | 'select' | 'multi'
  /** Whether a "Not sure" option is offered. */
  notSure: boolean
}
/** One impact line per item (impact.ts). */
export type Item = { id: string; title: string; questions: readonly Question[] }
export type Screen = {
  step: OpeningStep
  number: 1 | 2 | 3 | 4
  title: string
  sub: string
  next: string
  items: readonly Item[]
}

/** The answers to "Do you know what you want to study?", which the field and areas hang on. */
export const PARTICULAR = 'Something particular'
export const DRAWN_TO_AREAS = "A few areas I'm drawn to"
export const SUGGEST_ME = 'Suggest me'
/** The field's default: no field chosen, so every field. */
const ANY_FIELD = 'Any'
const AREAS_MAX = 3

const q = (
  key: QuestionKey,
  label: string,
  options: readonly AnswerValue[],
  more: Partial<Pick<Question, 'control' | 'notSure'>> = {},
): Question => ({ key, label, options, control: 'chips', notSure: true, ...more })

/** An item that is a single question, asked by the item's title. */
const single = (
  key: QuestionKey,
  title: string,
  options: readonly AnswerValue[],
  more: Partial<Pick<Question, 'control' | 'notSure'>> = {},
): Item => ({ id: key, title, questions: [q(key, '', options, more)] })

export const SCREENS: readonly Screen[] = [
  {
    step: 'facts',
    number: 1,
    title: 'Facts about you',
    sub: 'Two to four taps a question. “Not sure” is fine anywhere.',
    next: "Next: what you'd study",
    items: [
      single(
        'where',
        'Where are you right now?',
        [
          'Nepal',
          'India',
          'Bangladesh',
          'Sri Lanka',
          'Pakistan',
          'Bhutan',
          'Vietnam',
          'Philippines',
          'Indonesia',
          'China',
          'Australia (on a visa)',
          'Another country',
        ],
        { control: 'select' },
      ),
      {
        id: 'budget',
        title: 'Your budget per year',
        questions: [
          q('amount', 'Amount', [24, 30, 36, 42]),
          q('covers', 'It covers', ['Fees only', 'Fees and living']),
          q('who', 'Who pays', ['Family', 'Savings', 'Loan', 'A mix']),
          q('hard', 'Is this a hard limit, or roughly?', ['Hard limit', 'Roughly']),
        ],
      },
      {
        id: 'timing',
        title: 'Timing',
        questions: [
          q('earliest', 'Earliest start', ['Feb 2027', 'Jul 2027', 'Later']),
          q('latest', "Latest you'd accept", ['Feb 2027', 'Jul 2027', 'Feb 2028']),
          q('years', "Most years you'd give it", ['2', '3', '4 or more']),
        ],
      },
      single('dep', 'Anyone coming with you?', ['No one', 'Partner', 'Partner and children']),
      {
        id: 'quals',
        title: 'Your qualifications and scores',
        questions: [
          q('qual', 'Last qualification', ['High school', 'Diploma', "Bachelor's", "Master's"]),
          q('eng', 'English test', [
            'IELTS 6.0',
            'IELTS 6.5',
            'IELTS 7.0',
            'IELTS 7.5 or more',
            'Not taken yet',
          ]),
        ],
      },
    ],
  },
  {
    step: 'study',
    number: 2,
    title: "What you'd study",
    sub: 'Two to four taps. You can say “suggest me”.',
    next: "Next: where and how you'd live",
    items: [
      {
        id: 'know',
        title: 'Do you know what you want to study?',
        questions: [
          q('know', '', [PARTICULAR, DRAWN_TO_AREAS, SUGGEST_ME]),
          q('field', 'Which field?', [
            'Cyber security',
            'Data science',
            'Business analytics',
            'Information technology',
          ]),
          q(
            'areas',
            'Pick up to three',
            ['IT and computing', 'Business', 'Data', 'Health', 'Engineering', 'Design'],
            { control: 'multi', notSure: false },
          ),
        ],
      },
      single('level', 'Study level', ['Diploma', "Bachelor's", "Master's"]),
      single('learn', 'How you like to learn', [
        'Hands-on with placements',
        'Mostly classroom and research',
        'No preference',
      ]),
      single('length', "Course length you'd prefer", [
        'As short as possible',
        'Fine with longer if it opens more',
      ]),
    ],
  },
  {
    step: 'living',
    number: 3,
    title: "Where and how you'd live",
    sub: "Where you'd be happy, not just where the course is.",
    next: 'Next: after you graduate',
    items: [
      single('dest', 'Destination', ['Australia', 'Open to others']),
      single('place', 'Kind of place', ['City', 'Suburban', 'Regional']),
      {
        id: 'community',
        title: 'Does a community of similar culture, or relatives nearby, matter?',
        questions: [
          q('community', '', ['Yes', 'A little', 'No']),
          q('knows', 'Do you know anyone who lives in Australia?', ['Yes', 'No']),
        ],
      },
      single('climate', 'Climate (optional)', ['Mild', 'Warm', 'No preference'], {
        notSure: false,
      }),
    ],
  },
  {
    step: 'after',
    number: 4,
    title: 'After you graduate',
    sub: 'There are no wrong answers. Each one changes which roads stay open.',
    next: 'Show me three futures',
    items: [
      // "Not sure" is a real answer here, not an assumption (ADR-097).
      single('stay', 'Would you want to stay after?', ['Yes', NOT_SURE, 'No'], { notSure: false }),
      single('focus', 'Career-focused or academic?', ['Career-focused', 'Academic']),
      single('earn', 'Do you need to earn while studying?', ['Yes', 'Helpful', 'No']),
      single(
        'settle',
        'Settle long-term, or come home eventually? (optional)',
        ['Settle long-term', 'Come home eventually'],
        { notSure: false },
      ),
    ],
  },
]

/**
 * DS-D1's assumed values: what "Not sure" stores, and what an unanswered question counts as.
 * An unanswered stay counts as not sure (DS-D3 and ADR-097: weight 2, nothing sealed).
 */
export const DEFAULTS: Partial<Record<QuestionKey, AnswerValue>> = {
  where: 'Nepal',
  amount: 30,
  covers: 'Fees only',
  who: 'Family',
  hard: 'Roughly',
  earliest: 'Feb 2027',
  latest: 'Jul 2027',
  years: '3',
  dep: 'No one',
  qual: 'Unknown',
  eng: 'Unknown',
  know: SUGGEST_ME,
  field: ANY_FIELD,
  level: "Master's",
  learn: 'No preference',
  length: 'Fine with longer if it opens more',
  dest: 'Australia',
  place: 'Suburban',
  community: 'A little',
  knows: 'No',
  stay: NOT_SURE,
  focus: 'Career-focused',
  earn: 'Helpful',
}

const QUESTIONS = new Map<QuestionKey, Question>(
  SCREENS.flatMap((screen) =>
    screen.items.flatMap((item) => item.questions.map((x) => [x.key, x])),
  ),
)
/** The item each question sits in, for the questions its title asks. */
const ITEM_TITLES = new Map<QuestionKey, string>(
  SCREENS.flatMap((screen) =>
    screen.items.flatMap((item) => item.questions.map((x) => [x.key, item.title])),
  ),
)

export function questionOf(key: QuestionKey): Question {
  const question = QUESTIONS.get(key)
  if (!question) throw new Error(`No question for ${key}`)
  return question
}

/** Where the chip editor's heading reads differently from the opening's own words. */
const EDIT_LABELS: Partial<Record<QuestionKey, string>> = {
  amount: 'Your budget per year',
  field: "What you'd study",
}

/** What the chip editor calls a question: its label, else the title of the item that asks it. */
export function editLabel(key: QuestionKey): string {
  return EDIT_LABELS[key] ?? (questionOf(key).label || ITEM_TITLES.get(key) || '')
}

/** The stated or assumed value, else the default (undefined for a question with none). */
export function effective(answers: StoredAnswers, key: QuestionKey): AnswerValue | undefined {
  return answers[key]?.value ?? DEFAULTS[key]
}

/** "Not sure" was tapped, or the question is unanswered and has a default. */
export function isAssumed(answers: StoredAnswers, key: QuestionKey): boolean {
  const answer = answers[key]
  return answer ? answer.state === 'assumed' : DEFAULTS[key] !== undefined
}

export function isVisible(key: QuestionKey, answers: StoredAnswers): boolean {
  if (key === 'field') return effective(answers, 'know') === PARTICULAR
  if (key === 'areas') return effective(answers, 'know') === DRAWN_TO_AREAS
  if (key === 'knows') return answers.community !== undefined && answers.community.value !== 'No'
  return true
}

/**
 * Her person, only while screen 3 still shows that she knows someone: a "Yes" left behind when
 * community turned "No" no longer counts, so no future measures from someone she can't see.
 */
export function activeRelative(answers: StoredAnswers, relative: Relative | null): Relative | null {
  return isVisible('knows', answers) && effective(answers, 'knows') === 'Yes' ? relative : null
}

/** One to three distinct options. */
const isAreas = (options: readonly AnswerValue[], value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length >= 1 &&
  value.length <= AREAS_MAX &&
  new Set(value).size === value.length &&
  value.every((v) => options.includes(v))

const isOption = (question: Question, value: unknown): value is AnswerValue =>
  question.control === 'multi'
    ? isAreas(question.options, value)
    : (typeof value === 'string' || typeof value === 'number') && question.options.includes(value)

/**
 * What a tap stores, or null when it is not an answer to this question. "Not sure" (where
 * offered) stores the default, assumed; an option stores itself, stated. A stored answer (Undo
 * puts these back) is taken when it is a stated option or the assumed default.
 */
export function parseAnswer(key: QuestionKey, raw: unknown): StoredAnswer | null {
  const question = questionOf(key)
  const fallback = DEFAULTS[key]
  if (raw === NOT_SURE && question.notSure && fallback !== undefined) {
    return { value: fallback, state: 'assumed' }
  }
  if (isOption(question, raw)) return { value: raw, state: 'stated' }
  const stored = storedAnswerSchema.safeParse(raw)
  if (!stored.success) return null
  const { value, state } = stored.data
  if (state === 'stated') return isOption(question, value) ? { value, state } : null
  return fallback !== undefined && value === fallback ? { value, state } : null
}

/** The field, the areas, or any field, by what she said she knows. */
export function fieldsChosen(answers: StoredAnswers): {
  kind: 'field' | 'areas' | 'any'
  values: string[]
} {
  const know = effective(answers, 'know')
  if (know === PARTICULAR) {
    const field = effective(answers, 'field')
    if (typeof field === 'string' && field !== ANY_FIELD) return { kind: 'field', values: [field] }
  }
  if (know === DRAWN_TO_AREAS) {
    const areas = answers.areas?.value
    if (Array.isArray(areas) && areas.length > 0) return { kind: 'areas', values: [...areas] }
  }
  return { kind: 'any', values: [] }
}

const lower = (v: AnswerValue | undefined) => String(v).toLowerCase()

const CHIPS: Partial<Record<QuestionKey, (v: AnswerValue | undefined) => string>> = {
  amount: (v) => `Budget about AUD ${v}k a year`,
  who: (v) => `Who pays: ${lower(v)}`,
  learn: (v) => `Learning: ${lower(v)}`,
  community: (v) => `Community nearby: ${lower(v)}`,
  hard: (v) => (v === 'Hard limit' ? 'A hard limit' : 'A rough budget'),
  place: (v) => `Prefers ${lower(v)}`,
  latest: (v) => `Latest start ${v}`,
  stay: (v) =>
    v === 'Yes'
      ? 'Wants to stay after'
      : v === 'No'
        ? 'Not staying after'
        : 'Not sure about staying',
  earn: (v) => `Earning while studying: ${lower(v)}`,
  level: (v) => `Level: ${v}`,
  dest: (v) => (v === 'Open to others' ? 'Open to others · Australia shown' : 'Australia only'),
}

/**
 * Whether the field chip rests on an assumption: the field she left unsaid after "Something
 * particular", areas she has not picked yet, or a "Suggest me" she never said.
 */
function fieldAssumed(answers: StoredAnswers, kind: 'field' | 'areas' | 'any'): boolean {
  if (kind === 'areas') return false
  const know = effective(answers, 'know')
  if (know === PARTICULAR) return isAssumed(answers, 'field')
  if (know === DRAWN_TO_AREAS) return true
  return isAssumed(answers, 'know')
}

function fieldChip(answers: StoredAnswers): { text: string; assumed: boolean } {
  const { kind, values } = fieldsChosen(answers)
  const text =
    kind === 'field'
      ? `Field: ${values[0]}`
      : kind === 'areas'
        ? `Areas: ${values.join(', ')}`
        : 'Field: any (suggest me)'
  return { text, assumed: fieldAssumed(answers, kind) }
}

/** The answer as a chip on the futures, "Assumed: …" when it rests on an assumption. */
export function chipText(key: QuestionKey, answers: StoredAnswers): string {
  const { text, assumed } =
    key === 'field'
      ? fieldChip(answers)
      : { text: (CHIPS[key] ?? display)(effective(answers, key)), assumed: isAssumed(answers, key) }
  return assumed ? `Assumed: ${text}` : text
}

/** Any other answer reads as itself (covers: "Fees only", "Fees and living"). */
export function display(v: AnswerValue | undefined): string {
  if (v === undefined) return ''
  return Array.isArray(v) ? v.join(', ') : String(v)
}
