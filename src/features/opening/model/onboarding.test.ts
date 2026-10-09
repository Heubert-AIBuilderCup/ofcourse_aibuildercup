import { describe, expect, it } from 'bun:test'
import type { StoredAnswers } from '@/shared/types/student'
import {
  askedQuestions,
  FACT_QUESTIONS,
  FACT_SLUGS,
  FACTS_PATH,
  factKey,
  factPath,
  firstOpenQuestion,
  firstUnanswered,
  forwardPath,
  LIVING_PATH,
  ONBOARDING_STEPS,
  PANEL_COPY,
  PICTURE_PATH,
  QUESTION_STEPS,
  questionBySlug,
  questionOfPath,
  questionPath,
  STUDY_PATH,
  shownQuestion,
  stepOfPath,
  stepProgress,
  WELCOME_MINUTES,
  WELCOME_PATH,
} from './onboarding'
import { DRAWN_TO_AREAS, PARTICULAR, SUGGEST_ME } from './questions'

const KEYS = [
  'where',
  'amount',
  'covers',
  'who',
  'hard',
  'earliest',
  'latest',
  'years',
  'dep',
  'qual',
  'eng',
] as const

const stated = (...keys: (typeof KEYS)[number][]): StoredAnswers =>
  Object.fromEntries(keys.map((key) => [key, { value: 'x', state: 'stated' }]))

const know = (value: string): StoredAnswers => ({ know: { value, state: 'stated' } })
/** Every question step 02 asks for this "know" answer, each with a stored answer. */
const studyAnswered = (value: string): StoredAnswers => ({
  ...know(value),
  field: { value: 'Data science', state: 'stated' },
  areas: { value: ['Data'], state: 'stated' },
  level: { value: "Master's", state: 'stated' },
  learn: { value: 'No preference', state: 'stated' },
  length: { value: 'As short as possible', state: 'stated' },
})

describe('FACT_QUESTIONS', () => {
  it('asks the eleven questions in the model order', () => {
    expect(FACT_QUESTIONS.map((q) => q.key)).toEqual([...KEYS])
  })

  it('reads the group and question from the model', () => {
    expect(FACT_QUESTIONS[0]).toMatchObject({
      group: '',
      question: 'Where are you right now?',
      itemId: 'where',
    })
    expect(FACT_QUESTIONS[1]).toMatchObject({
      group: 'Your budget per year',
      question: 'Amount',
      itemId: 'budget',
    })
    expect(FACT_QUESTIONS[8]).toMatchObject({ group: '', question: 'Anyone coming with you?' })
  })

  it('says why each question is asked', () => {
    for (const q of FACT_QUESTIONS) expect(q.why.length).toBeGreaterThan(0)
    expect(FACT_QUESTIONS[0]?.why).toBe(
      "It decides whether you'd apply for a visa from home or from inside Australia, and which fees apply.",
    )
  })
})

describe('firstUnanswered', () => {
  it('starts at where', () => {
    expect(firstUnanswered({})).toBe('where')
  })

  it('lands on the first question without an answer', () => {
    expect(firstUnanswered(stated('where', 'amount'))).toBe('covers')
  })

  it('counts an assumed answer as answered', () => {
    expect(
      firstUnanswered({
        where: { value: 'Nepal', state: 'assumed' },
        amount: { value: 30, state: 'assumed' },
      }),
    ).toBe('covers')
  })

  it('stays on the last question once all are answered', () => {
    expect(firstUnanswered(stated(...KEYS))).toBe('eng')
  })
})

describe('the step URLs', () => {
  it('names the steps under /onboarding', () => {
    expect(PICTURE_PATH).toBe('/onboarding/character')
    expect(FACTS_PATH).toBe('/onboarding/facts')
    expect(STUDY_PATH).toBe('/onboarding/study')
    expect(LIVING_PATH).toBe('/onboarding/living')
  })
})

describe('the question slugs', () => {
  it('gives each question a readable slug, in order', () => {
    expect(FACT_QUESTIONS.map((q) => FACT_SLUGS[q.key as keyof typeof FACT_SLUGS])).toEqual([
      'where',
      'amount',
      'covers',
      'who-pays',
      'limit',
      'earliest',
      'latest',
      'years',
      'coming',
      'qualification',
      'english',
    ])
  })

  it('maps every slug back to its key', () => {
    for (const q of FACT_QUESTIONS) expect(factKey(factPath(q.key).split('/').pop())).toBe(q.key)
  })

  it('carries each step 01 question its slug', () => {
    for (const q of FACT_QUESTIONS) {
      expect(q.slug).toBe(FACT_SLUGS[q.key as keyof typeof FACT_SLUGS])
      expect(q.opensWithLine).toBe(false)
    }
  })
})

describe('factPath and factKey', () => {
  it('puts the question in the URL as its slug', () => {
    expect(factPath('amount')).toBe('/onboarding/facts/amount')
    expect(factPath('hard')).toBe('/onboarding/facts/limit')
    expect(factPath('eng')).toBe('/onboarding/facts/english')
  })

  it('reads a slug as its key, never a key as a slug', () => {
    expect(factKey('who-pays')).toBe('who')
    expect(factKey('hard')).toBeNull()
    expect(factKey('field')).toBeNull()
    expect(factKey('nope')).toBeNull()
    expect(factKey(null)).toBeNull()
    expect(factKey(undefined)).toBeNull()
  })
})

describe('stepOfPath', () => {
  it('knows the steps built on the shell', () => {
    expect(stepOfPath('/onboarding/character')).toBe(0)
    expect(stepOfPath('/onboarding/facts')).toBe(1)
    expect(stepOfPath('/onboarding/facts/amount')).toBe(1)
    expect(stepOfPath('/onboarding/facts/who-pays')).toBe(1)
  })

  it('knows the welcome, before step 00', () => {
    expect(WELCOME_PATH).toBe('/onboarding/welcome')
    expect(WELCOME_MINUTES).toBe(10)
    expect(stepOfPath('/onboarding/welcome')).toBe('welcome')
    expect(stepOfPath('/onboarding/character')).toBe(0)
  })

  it('knows step 02, the study step and every question under it', () => {
    expect(stepOfPath('/onboarding/study')).toBe(2)
    expect(stepOfPath('/onboarding/study/level')).toBe(2)
    expect(stepOfPath('/onboarding/studyx')).toBeNull()
  })

  it('knows nothing of the others, nor of the retired paths', () => {
    expect(stepOfPath('/onboarding/living')).toBeNull()
    expect(stepOfPath('/onboarding')).toBeNull()
    expect(stepOfPath('/onboarding/factsx')).toBeNull()
    expect(stepOfPath('/picture')).toBeNull()
    expect(stepOfPath('/opening/facts')).toBeNull()
  })
})

describe('the panel', () => {
  it('lists the seven steps, step 00 first', () => {
    expect(ONBOARDING_STEPS).toEqual([
      'Your comic character',
      'Facts about you',
      "What you'd study",
      "Where and how you'd live",
      'After you graduate',
      'Three futures',
      'Your attention',
    ])
  })

  it('has its copy per step', () => {
    expect(PANEL_COPY[0]).toEqual(PANEL_COPY[1])
    expect(PANEL_COPY[2]).toEqual(PANEL_COPY[1])
    expect(PANEL_COPY[1]).toEqual({
      title: 'Six short steps',
      lead: 'Each step says why it asks. Nothing is ranked: at the end you see three futures side by side.',
    })
  })

  it('has the welcome its own copy', () => {
    expect(PANEL_COPY.welcome).toEqual({
      title: 'Before we start',
      lead: "Here's the whole way through. Each step says why it asks.",
    })
  })

  it('never ranks (criterion 2)', () => {
    for (const { title, lead } of Object.values(PANEL_COPY))
      expect(`${title} ${lead}`).not.toMatch(/recommended|best/i)
  })
})

describe('QUESTION_STEPS', () => {
  it('describes step 01 by what it already was', () => {
    const step = QUESTION_STEPS[1]
    expect(step.title).toBe('Facts about you')
    expect(step.path).toBe(FACTS_PATH)
    expect(step.questions).toBe(FACT_QUESTIONS)
    expect(step.back).toBe(PICTURE_PATH)
    expect(step.nextName).toBe("What you'd study")
  })

  it('describes step 02', () => {
    const step = QUESTION_STEPS[2]
    expect(step.title).toBe("What you'd study")
    expect(step.path).toBe(STUDY_PATH)
    expect(step.back).toBe('/onboarding/facts/english')
    expect(step.nextName).toBe("Where and how you'd live")
  })

  it('asks step 02 in the model order, each under its slug and never its key', () => {
    const questions = QUESTION_STEPS[2].questions
    expect(questions.map((q) => q.key)).toEqual([
      'know',
      'field',
      'areas',
      'level',
      'learn',
      'length',
    ])
    expect(questions.map((q) => q.slug)).toEqual([
      'know',
      'field',
      'areas',
      'level',
      'learning',
      'length',
    ])
  })

  it('reads step 02 from the model: the item, the question', () => {
    expect(QUESTION_STEPS[2].questions.map((q) => [q.itemId, q.question])).toEqual([
      ['know', 'Do you know what you want to study?'],
      ['know', 'Which field?'],
      ['know', 'Pick up to three'],
      ['level', 'Study level'],
      ['learn', 'How you like to learn'],
      ['length', "Course length you'd prefer"],
    ])
  })

  it('groups the field and the areas under the answer that opens them', () => {
    expect(QUESTION_STEPS[2].questions.map((q) => q.group)).toEqual([
      '',
      PARTICULAR,
      DRAWN_TO_AREAS,
      '',
      '',
      '',
    ])
    expect(PARTICULAR).toBe('Something particular')
    expect(DRAWN_TO_AREAS).toBe("A few areas I'm drawn to")
  })

  it('opens the field and the areas with their line, which asks for them', () => {
    expect(QUESTION_STEPS[2].questions.map((q) => q.opensWithLine)).toEqual([
      false,
      true,
      true,
      false,
      false,
      false,
    ])
  })

  it('says why each step 02 question is asked', () => {
    expect(QUESTION_STEPS[2].questions.map((q) => q.why)).toEqual([
      'It sets how wide your futures start: one field, a few areas, or every field in this preview.',
      'Your futures are drawn from courses in this field. You can change it on each one.',
      'Courses from each area you pick show side by side, so you can compare them.',
      'It sets the course length and entry each future is built on.',
      "It shapes what each future is drawn around. It doesn't put one above another.",
      'Length changes the cost, and how long you could work in Australia after you finish.',
    ])
  })

  it('never ranks in a why line (criterion 2)', () => {
    for (const q of QUESTION_STEPS[2].questions) expect(q.why).not.toMatch(/recommended|best/i)
  })
})

describe('questionPath, questionBySlug and questionOfPath', () => {
  it('puts the question in the URL as its slug', () => {
    expect(questionPath(2, 'learn')).toBe('/onboarding/study/learning')
    expect(questionPath(2, 'know')).toBe('/onboarding/study/know')
    expect(questionPath(1, 'who')).toBe('/onboarding/facts/who-pays')
  })

  it('reads a slug as its question, never a key as a slug', () => {
    expect(questionBySlug(2, 'learning')?.key).toBe('learn')
    expect(questionBySlug(2, 'learn')).toBeNull()
    expect(questionBySlug(2, 'nope')).toBeNull()
    expect(questionBySlug(2, null)).toBeNull()
    expect(questionBySlug(2, undefined)).toBeNull()
    expect(questionBySlug(1, 'who-pays')?.key).toBe('who')
  })

  it("does not read another step's slug", () => {
    expect(questionBySlug(2, 'amount')).toBeNull()
    expect(questionBySlug(1, 'level')).toBeNull()
  })

  it('reads the question a URL names from its last segment', () => {
    expect(questionOfPath(2, '/onboarding/study/areas')?.key).toBe('areas')
    expect(questionOfPath(1, '/onboarding/facts/limit')?.key).toBe('hard')
  })

  it('names no question for the bare step, another step, or a key', () => {
    expect(questionOfPath(2, '/onboarding/study')).toBeNull()
    expect(questionOfPath(2, '/onboarding/study/learn')).toBeNull()
    expect(questionOfPath(2, '/onboarding/facts/amount')).toBeNull()
    expect(questionOfPath(2, '/onboarding/facts/level')).toBeNull()
    expect(questionOfPath(1, '/onboarding/study/level')).toBeNull()
  })
})

describe('askedQuestions', () => {
  const keys = (step: 1 | 2, answers: StoredAnswers) =>
    askedQuestions(step, answers).map((q) => q.key)

  it('asks step 01 whole', () => {
    expect(keys(1, {})).toEqual([...KEYS])
  })

  it('asks neither the field nor the areas until she says what she knows', () => {
    expect(keys(2, {})).toEqual(['know', 'level', 'learn', 'length'])
  })

  it('asks the field for "Something particular"', () => {
    expect(keys(2, know(PARTICULAR))).toEqual(['know', 'field', 'level', 'learn', 'length'])
  })

  it('asks the areas for "A few areas I\'m drawn to"', () => {
    expect(keys(2, know(DRAWN_TO_AREAS))).toEqual(['know', 'areas', 'level', 'learn', 'length'])
  })

  it('asks neither for "Suggest me", stated or assumed', () => {
    const four = ['know', 'level', 'learn', 'length'] as const
    expect(keys(2, know(SUGGEST_ME))).toEqual([...four])
    expect(keys(2, { know: { value: SUGGEST_ME, state: 'assumed' } })).toEqual([...four])
  })
})

describe('firstOpenQuestion', () => {
  it('starts step 02 at know', () => {
    expect(firstOpenQuestion(2, {})).toBe('know')
  })

  it('skips to level after "Suggest me"', () => {
    expect(firstOpenQuestion(2, know(SUGGEST_ME))).toBe('level')
  })

  it('goes to the field after "Something particular"', () => {
    expect(firstOpenQuestion(2, know(PARTICULAR))).toBe('field')
  })

  it('goes to the areas after "A few areas I\'m drawn to"', () => {
    expect(firstOpenQuestion(2, know(DRAWN_TO_AREAS))).toBe('areas')
  })

  it('stays on the last question once every asked question is answered', () => {
    expect(firstOpenQuestion(2, studyAnswered(PARTICULAR))).toBe('length')
    expect(firstOpenQuestion(2, studyAnswered(DRAWN_TO_AREAS))).toBe('length')
    expect(firstOpenQuestion(2, studyAnswered(SUGGEST_ME))).toBe('length')
  })

  it('does not count a field left over after "know" changed', () => {
    const { areas: _areas, ...answers } = studyAnswered(SUGGEST_ME)
    expect(firstOpenQuestion(2, answers)).toBe('length')
    const { level: _level, ...withoutLevel } = answers
    expect(firstOpenQuestion(2, withoutLevel)).toBe('level')
  })

  it('counts an assumed answer as answered', () => {
    expect(firstOpenQuestion(2, { know: { value: SUGGEST_ME, state: 'assumed' } })).toBe('level')
  })

  it("is step 01's firstUnanswered for step 01", () => {
    expect(firstOpenQuestion(1, {})).toBe('where')
    expect(firstOpenQuestion(1, stated('where', 'amount'))).toBe('covers')
    expect(firstOpenQuestion(1, stated(...KEYS))).toBe('eng')
  })
})

describe('forwardPath', () => {
  it("leaves step 01 for step 02's first open question", () => {
    expect(forwardPath(1, {})).toBe('/onboarding/study/know')
    expect(forwardPath(1, know(SUGGEST_ME))).toBe('/onboarding/study/level')
  })

  it('leaves step 02 for step 03', () => {
    expect(forwardPath(2, {})).toBe('/onboarding/living')
    expect(forwardPath(2, studyAnswered(PARTICULAR))).toBe(LIVING_PATH)
  })
})

describe('shownQuestion', () => {
  it('is the question the URL names, when it is asked', () => {
    expect(shownQuestion(2, '/onboarding/study/level', know(SUGGEST_ME)).key).toBe('level')
    expect(shownQuestion(2, '/onboarding/study/field', know(PARTICULAR)).key).toBe('field')
    expect(shownQuestion(1, '/onboarding/facts/amount', {}).key).toBe('amount')
  })

  it('is her first open question when the URL names one not asked, or none', () => {
    expect(shownQuestion(2, '/onboarding/study/field', know(SUGGEST_ME)).key).toBe('level')
    expect(shownQuestion(2, '/onboarding/study/areas', {}).key).toBe('know')
    expect(shownQuestion(2, '/onboarding/study', know(SUGGEST_ME)).key).toBe('level')
    expect(shownQuestion(1, '/onboarding/facts', stated('where')).key).toBe('amount')
  })

  it('is the last asked question when every one is answered', () => {
    expect(shownQuestion(2, '/onboarding/study/areas', studyAnswered(PARTICULAR)).key).toBe(
      'length',
    )
  })
})

describe('stepProgress', () => {
  it('counts a step 02 question among those asked', () => {
    expect(stepProgress('/onboarding/study/know', {})).toEqual({ question: 1, total: 4 })
    expect(stepProgress('/onboarding/study/areas', know(DRAWN_TO_AREAS))).toEqual({
      question: 2,
      total: 5,
    })
    expect(stepProgress('/onboarding/study/length', know(PARTICULAR))).toEqual({
      question: 5,
      total: 5,
    })
  })

  it('counts a step 01 question among the eleven', () => {
    expect(stepProgress('/onboarding/facts/amount', {})).toEqual({ question: 2, total: 11 })
  })

  it('reads 1 when the URL names no asked question', () => {
    expect(stepProgress('/onboarding/study', {})).toEqual({ question: 1, total: 4 })
    expect(stepProgress('/onboarding/facts', {})).toEqual({ question: 1, total: 11 })
    expect(stepProgress('/onboarding/study/field', {})).toEqual({ question: 1, total: 4 })
  })

  it('counts the question the screen shows when the URL names one not asked', () => {
    // "Suggest me" asks no field; the screen shows her first open question, the level (2 of 4).
    expect(stepProgress('/onboarding/study/field', know(SUGGEST_ME))).toEqual({
      question: 2,
      total: 4,
    })
  })

  it('counts nothing outside the question steps', () => {
    expect(stepProgress('/onboarding/character', {})).toBeNull()
    expect(stepProgress('/onboarding/welcome', {})).toBeNull()
    expect(stepProgress('/onboarding/living', {})).toBeNull()
  })
})
