import { describe, expect, it } from 'bun:test'
import type { StoredAnswers } from '@/shared/types/student'
import {
  FACT_QUESTIONS,
  FACT_SLUGS,
  FACTS_PATH,
  factIndex,
  factIndexOfPath,
  factKey,
  factPath,
  firstUnanswered,
  ONBOARDING_STEPS,
  PANEL_COPY,
  PICTURE_PATH,
  STUDY_PATH,
  stepOfPath,
  WELCOME_MINUTES,
  WELCOME_PATH,
} from './onboarding'

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
})

describe('factPath, factKey and factIndex', () => {
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

  it('finds a question by slug, else -1', () => {
    expect(factIndex('amount')).toBe(1)
    expect(factIndex('who-pays')).toBe(3)
    expect(factIndex('who')).toBe(-1)
    expect(factIndex('nope')).toBe(-1)
    expect(factIndex(null)).toBe(-1)
    expect(factIndex(undefined)).toBe(-1)
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

  it('knows nothing of the others, nor of the retired paths', () => {
    expect(stepOfPath('/onboarding/study')).toBeNull()
    expect(stepOfPath('/onboarding')).toBeNull()
    expect(stepOfPath('/onboarding/factsx')).toBeNull()
    expect(stepOfPath('/picture')).toBeNull()
    expect(stepOfPath('/opening/facts')).toBeNull()
  })
})

describe('factIndexOfPath', () => {
  it("reads the step 01 question's place from its URL", () => {
    expect(factIndexOfPath('/onboarding/facts/where')).toBe(0)
    expect(factIndexOfPath('/onboarding/facts/limit')).toBe(4)
  })

  it('is -1 for any other page, and for step 01 with no question named', () => {
    expect(factIndexOfPath('/onboarding/character')).toBe(-1)
    expect(factIndexOfPath('/onboarding/facts')).toBe(-1)
    expect(factIndexOfPath('/onboarding/where')).toBe(-1)
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
