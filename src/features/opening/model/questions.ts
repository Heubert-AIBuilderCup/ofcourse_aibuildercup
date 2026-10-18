// The one definition of onboarding steps 01–04's questions: their options, DS-D1 defaults, which
// questions show, and how each answer is stored and shown. Pure, so the screens, the engine and
// the server actions all read the same rules.

import {
  type AnswerValue,
  AREAS_MAX,
  type QuestionKey,
  type Relative,
  type StoredAnswer,
  type StoredAnswers,
  storedAnswerSchema,
} from '@/shared/types/student'
import { NOT_TAKEN, parseEnglish } from './english'

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
export type Screen = { items: readonly Item[] }

/** The answers to "Do you know what you want to study?", which the field and areas hang on. */
export const PARTICULAR = 'Something particular'
export const DRAWN_TO_AREAS = "A few areas I'm drawn to"
export const SUGGEST_ME = 'Suggest me'
/** The field's default: no field chosen, so every field. */
const ANY_FIELD = 'Any'

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
            NOT_TAKEN,
          ]),
        ],
      },
    ],
  },
  {
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
            'Psychology',
          ]),
          q(
            'areas',
            'Pick up to three',
            [
              'IT and computing',
              'Business',
              'Health',
              'Engineering',
              'Design',
              'Psychology',
              'Education / Teaching',
              'Social work',
              'Hospitality & tourism',
            ],
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
    items: [
      single('dest', 'Destination', ['Australia', 'Open to others']),
      single('place', 'Kind of place', ['City', 'Suburban', 'Regional']),
      single('community', 'Does a community of similar culture, or relatives nearby, matter?', [
        'Yes',
        'A little',
        'No',
      ]),
      single('knows', 'Do you know anyone who lives in Australia?', ['Yes', 'No']),
      single('climate', 'Climate (optional)', ['Mild', 'Warm', 'No preference'], {
        notSure: false,
      }),
    ],
  },
  {
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

export function questionOf(key: QuestionKey): Question {
  const question = QUESTIONS.get(key)
  if (!question) throw new Error(`No question for ${key}`)
  return question
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
 * Questions no longer asked (16 Oct 2026): their answers change nothing she sees. They keep their
 * keys, options and stored answers, which stay readable; onboarding, Your answers and her own
 * words just never ask them.
 */
export const HIDDEN_QUESTIONS: ReadonlySet<QuestionKey> = new Set<QuestionKey>([
  'who',
  'learn',
  'length',
  'climate',
  'earn',
  'settle',
])

/** Whether onboarding asks this question for these answers: shown, and not hidden. */
export function isAsked(key: QuestionKey, answers: StoredAnswers): boolean {
  return !HIDDEN_QUESTIONS.has(key) && isVisible(key, answers)
}

/**
 * Her person, only while screen 3 still shows that she knows someone: a "Yes" left behind when
 * community turned "No" no longer counts, so no future measures from someone she can't see.
 */
export function activeRelative(answers: StoredAnswers, relative: Relative | null): Relative | null {
  return isVisible('knows', answers) && effective(answers, 'knows') === 'Yes' ? relative : null
}

/** Areas an earlier onboarding offered, each read as the area that took it in. */
export const RETIRED_AREAS: Readonly<Record<string, string>> = { Data: 'IT and computing' }

const retired = (v: unknown): v is string =>
  typeof v === 'string' && Object.hasOwn(RETIRED_AREAS, v)

/**
 * Her areas with each retired one read as the area that took it in, that area once; any other
 * value as it is (a repeated area stays repeated, for the question to refuse).
 */
function currentAreas(value: unknown): unknown {
  return Array.isArray(value) && value.some(retired)
    ? [...new Set(value.map((v) => (retired(v) ? RETIRED_AREAS[v] : v)))]
    : value
}

/** An areas answer, given bare or stored, with retired areas read as today's. */
const withCurrentAreas = (raw: unknown): unknown =>
  raw !== null && typeof raw === 'object' && 'value' in raw
    ? { ...raw, value: currentAreas(raw.value) }
    : currentAreas(raw)

/** One to three distinct options. */
const isAreas = (options: readonly AnswerValue[], value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length >= 1 &&
  value.length <= AREAS_MAX &&
  new Set(value).size === value.length &&
  value.every((v) => options.includes(v))

/** The English test also takes her exact score ("PTE 58"), the one question with a free value. */
const isOption = (question: Question, value: unknown): value is AnswerValue =>
  question.control === 'multi'
    ? isAreas(question.options, value)
    : ((typeof value === 'string' || typeof value === 'number') &&
        question.options.includes(value)) ||
      (question.key === 'eng' && parseEnglish(value) !== null)

/**
 * What a tap stores, or null when it is not an answer to this question. "Not sure" (where
 * offered) stores the default, assumed; an option stores itself, stated. A stored answer (Undo
 * puts these back) is taken when it is a stated option or the assumed default. Areas an earlier
 * onboarding offered read as the area that took them in (Data as IT and computing).
 */
export function parseAnswer(key: QuestionKey, given: unknown): StoredAnswer | null {
  const raw = key === 'areas' ? withCurrentAreas(given) : given
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

/** Any other answer reads as itself (covers: "Fees only", "Fees and living"). */
export function display(v: AnswerValue | undefined): string {
  if (v === undefined) return ''
  return Array.isArray(v) ? v.join(', ') : String(v)
}
