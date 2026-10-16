import { describe, expect, it } from 'bun:test'
import type { Relative, StoredAnswers } from '@/shared/types/student'
import {
  askedQuestions,
  backPath,
  firstOpenQuestion,
  forwardPath,
  LIVING_PATH,
  nextOpenQuestion,
  nextPath,
  OWN_WORDS_STEP_AT,
  PANEL_COPY,
  PERSON,
  QUESTION_STEPS,
  questionBySlug,
  questionOfPath,
  questionPath,
  shownQuestion,
  stepOfPath,
  stepProgress,
} from './onboarding'
import { DRAWN_TO_AREAS, PARTICULAR, SUGGEST_ME } from './questions'

/** Step 01's questions as asked: who pays is hidden (16 Oct 2026). */
const KEYS = [
  'where',
  'amount',
  'covers',
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

const yes = (value: string) => ({ value, state: 'stated' }) as const
/** Step 03 answered up to "Do you know anyone…" Yes; the person still open. */
const knowsSomeone: StoredAnswers = {
  dest: yes('Australia'),
  place: yes('City'),
  community: yes('Yes'),
  knows: yes('Yes'),
}
const cousin: Relative = { placeId: null, place: null, relationship: 'Cousin', name: null }

describe('step 01', () => {
  it('groups a question under its item title when the item asks more than one', () => {
    const facts = QUESTION_STEPS[1].questions
    expect(facts[0]).toMatchObject({ group: '', question: 'Where are you right now?' })
    expect(facts[1]).toMatchObject({ group: 'Your budget per year', question: 'Amount' })
  })

  it('gives each question a readable slug, in order', () => {
    expect(QUESTION_STEPS[1].questions.map((q) => q.slug)).toEqual([
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
})

describe('the question slugs', () => {
  it('map every question of every step to its URL and back', () => {
    for (const step of [1, 2, 3, 4] as const)
      for (const q of QUESTION_STEPS[step].questions)
        expect(questionBySlug(step, questionPath(step, q.key).split('/').pop())?.key).toBe(q.key)
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
    expect(stepOfPath('/onboarding/welcome')).toBe('welcome')
    expect(stepOfPath('/onboarding/character')).toBe(0)
  })

  it('knows step 02, the study step and every question under it', () => {
    expect(stepOfPath('/onboarding/study')).toBe(2)
    expect(stepOfPath('/onboarding/study/level')).toBe(2)
    expect(stepOfPath('/onboarding/studyx')).toBeNull()
  })

  it('knows step 03, the living step and every question under it', () => {
    expect(stepOfPath('/onboarding/living')).toBe(3)
    expect(stepOfPath('/onboarding/living/who-and-where')).toBe(3)
    expect(stepOfPath('/onboarding/livingx')).toBeNull()
  })

  it('knows step 04, the after step and every question under it', () => {
    expect(stepOfPath('/onboarding/after')).toBe(4)
    expect(stepOfPath('/onboarding/after/focus')).toBe(4)
    expect(stepOfPath('/onboarding/afterx')).toBeNull()
  })

  it('knows step 05, your attention, and the end screen after it', () => {
    expect(stepOfPath('/onboarding/attention')).toBe(5)
    expect(stepOfPath('/onboarding/done')).toBe('done')
    expect(stepOfPath('/onboarding/attentionx')).toBeNull()
  })

  it('knows nothing of the others, nor of the retired paths', () => {
    expect(stepOfPath('/onboarding')).toBeNull()
    expect(stepOfPath('/onboarding/factsx')).toBeNull()
    expect(stepOfPath('/picture')).toBeNull()
    expect(stepOfPath('/opening/facts')).toBeNull()
  })
})

describe('the panel', () => {
  it('never ranks (criterion 2)', () => {
    for (const { title, lead } of Object.values(PANEL_COPY))
      expect(`${title} ${lead}`).not.toMatch(/recommended|best/i)
  })
})

describe('OWN_WORDS_STEP_AT', () => {
  it("offers own words on steps 02 to 04, never on step 01's objective facts (16 Oct 2026)", () => {
    expect(OWN_WORDS_STEP_AT[1]).toBeUndefined()
    expect([OWN_WORDS_STEP_AT[2], OWN_WORDS_STEP_AT[3], OWN_WORDS_STEP_AT[4]]).toEqual([
      'study',
      'living',
      'after',
    ])
  })
})

describe('backPath', () => {
  it("goes back from each step's first question to the last question asked on the step before", () => {
    expect(backPath(1, {})).toBe('/onboarding/character')
    expect(backPath(2, {})).toBe('/onboarding/facts/english')
    expect(backPath(3, {})).toBe('/onboarding/study/level')
    expect(backPath(4, {})).toBe('/onboarding/living/community')
  })

  it("goes back from step 04 to the last of step 03's questions her answers ask", () => {
    expect(backPath(4, { community: yes('Yes') })).toBe('/onboarding/living/know-anyone')
    expect(backPath(4, knowsSomeone)).toBe('/onboarding/living/who-and-where')
    expect(backPath(4, { ...knowsSomeone, community: yes('No') })).toBe(
      '/onboarding/living/community',
    )
  })
})

describe('QUESTION_STEPS', () => {
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

  it('shows the field and the areas on the line of the question that opens them', () => {
    expect(QUESTION_STEPS[2].questions.map((q) => q.itemId)).toEqual([
      'know',
      'know',
      'know',
      'level',
      'learn',
      'length',
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

  it('never ranks in a why line (criterion 2)', () => {
    for (const q of QUESTION_STEPS[2].questions) expect(q.why).not.toMatch(/recommended|best/i)
  })

  it('asks step 03 in order, each under its slug, the person under a key of its own', () => {
    expect(QUESTION_STEPS[3].questions.map((q) => [q.key, q.itemId, q.slug])).toEqual([
      ['dest', 'dest', 'destination'],
      ['place', 'place', 'place'],
      ['community', 'community', 'community'],
      ['knows', 'knows', 'know-anyone'],
      [PERSON, PERSON, 'who-and-where'],
      ['climate', 'climate', 'climate'],
    ])
  })

  it('asks step 04 in order, each under its slug (criteria 1 and 2)', () => {
    expect(QUESTION_STEPS[4].questions.map((q) => [q.key, q.slug])).toEqual([
      ['stay', 'stay'],
      ['focus', 'focus'],
      ['earn', 'earning'],
      ['settle', 'long-term'],
    ])
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
    expect(questionBySlug(1, 'hard')).toBeNull()
  })

  it('puts step 03 in the URL as its slugs, the person included', () => {
    expect(questionPath(3, 'dest')).toBe('/onboarding/living/destination')
    expect(questionPath(3, 'knows')).toBe('/onboarding/living/know-anyone')
    expect(questionPath(3, PERSON)).toBe('/onboarding/living/who-and-where')
    expect(questionBySlug(3, 'who-and-where')?.key).toBe(PERSON)
    expect(questionBySlug(3, 'know-anyone')?.key).toBe('knows')
    expect(questionBySlug(3, 'person')).toBeNull()
    expect(questionBySlug(3, 'knows')).toBeNull()
    expect(questionOfPath(3, '/onboarding/living/climate')?.key).toBe('climate')
  })

  it('reads a step 04 slug as its question, never a key or an unknown slug', () => {
    expect(questionBySlug(4, 'earning')?.key).toBe('earn')
    expect(questionBySlug(4, 'long-term')?.key).toBe('settle')
    expect(questionBySlug(4, 'earn')).toBeNull()
    expect(questionBySlug(4, 'settle')).toBeNull()
    expect(questionBySlug(4, 'nope')).toBeNull()
    expect(questionPath(4, 'earn')).toBe('/onboarding/after/earning')
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
  const keys = (step: 1 | 2 | 3 | 4, answers: StoredAnswers) =>
    askedQuestions(step, answers).map((q) => q.key)

  it('asks step 01 whole', () => {
    expect(keys(1, {})).toEqual([...KEYS])
  })

  it('asks neither the field nor the areas until she says what she knows', () => {
    expect(keys(2, {})).toEqual(['know', 'level'])
  })

  it('asks the field for "Something particular"', () => {
    expect(keys(2, know(PARTICULAR))).toEqual(['know', 'field', 'level'])
  })

  it('asks the areas for "A few areas I\'m drawn to"', () => {
    expect(keys(2, know(DRAWN_TO_AREAS))).toEqual(['know', 'areas', 'level'])
  })

  it('asks neither for "Suggest me", stated or assumed', () => {
    const two = ['know', 'level'] as const
    expect(keys(2, know(SUGGEST_ME))).toEqual([...two])
    expect(keys(2, { know: { value: SUGGEST_ME, state: 'assumed' } })).toEqual([...two])
  })

  it('asks step 03 its three until community is answered', () => {
    expect(keys(3, {})).toEqual(['dest', 'place', 'community'])
  })

  it('asks whether she knows anyone once community is not No', () => {
    expect(keys(3, { community: yes('Yes') })).toEqual(['dest', 'place', 'community', 'knows'])
  })

  it('asks who and where only after a stated Yes', () => {
    expect(keys(3, { community: yes('A little'), knows: yes('Yes') })).toEqual([
      'dest',
      'place',
      'community',
      'knows',
      PERSON,
    ])
    expect(
      keys(3, { community: yes('A little'), knows: { value: 'No', state: 'assumed' } }),
    ).not.toContain(PERSON)
    expect(
      keys(3, { community: yes('A little'), knows: { value: 'Yes', state: 'assumed' } }),
    ).not.toContain(PERSON)
  })

  it('asks step 04 both, in order, whatever the answers', () => {
    const two = ['stay', 'focus'] as const
    expect(keys(4, {})).toEqual([...two])
    expect(keys(4, { stay: yes('No'), focus: yes('Academic'), community: yes('No') })).toEqual([
      ...two,
    ])
  })

  it('asks neither once community turns No after a Yes', () => {
    expect(keys(3, { community: yes('No'), knows: yes('Yes') })).toEqual([
      'dest',
      'place',
      'community',
    ])
  })

  it('never asks the six hidden questions, even with an answer stored for each (16 Oct 2026)', () => {
    const stored: StoredAnswers = {
      who: yes('Loan'),
      learn: yes('No preference'),
      length: yes('As short as possible'),
      climate: yes('Mild'),
      earn: yes('Yes'),
      settle: yes('Settle long-term'),
    }
    const asked = ([1, 2, 3, 4] as const).flatMap((step) => keys(step, stored))
    for (const key of Object.keys(stored)) expect(asked).not.toContain(key)
  })
})

describe('nextOpenQuestion', () => {
  it('skips every answered question after this one, not only those before the first gap', () => {
    const answers = stated('where', 'amount', 'hard', 'earliest', 'latest', 'dep', 'qual', 'eng')
    expect(nextOpenQuestion(1, answers, 'where')).toBe('covers')
    expect(nextOpenQuestion(1, answers, 'covers')).toBe('years')
    expect(nextOpenQuestion(1, answers, 'years')).toBeNull()
  })

  it('is null when nothing after this one is open: the step is done', () => {
    expect(nextOpenQuestion(2, studyAnswered(PARTICULAR), 'level')).toBeNull()
  })

  it('opens her person while none is stored, and skips it once one is', () => {
    expect(nextOpenQuestion(3, knowsSomeone, 'place', null)).toBe(PERSON)
    expect(nextOpenQuestion(3, knowsSomeone, 'place', cousin)).toBeNull()
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
    expect(firstOpenQuestion(2, studyAnswered(PARTICULAR))).toBe('level')
    expect(firstOpenQuestion(2, studyAnswered(DRAWN_TO_AREAS))).toBe('level')
    expect(firstOpenQuestion(2, studyAnswered(SUGGEST_ME))).toBe('level')
  })

  it('does not count a field left over after "know" changed', () => {
    const { areas: _areas, ...answers } = studyAnswered(SUGGEST_ME)
    expect(firstOpenQuestion(2, answers)).toBe('level')
    const { level: _level, ...withoutLevel } = answers
    expect(firstOpenQuestion(2, withoutLevel)).toBe('level')
  })

  it('counts an assumed answer as answered', () => {
    expect(firstOpenQuestion(2, { know: { value: SUGGEST_ME, state: 'assumed' } })).toBe('level')
  })

  it('starts step 03 at the destination', () => {
    expect(firstOpenQuestion(3, {})).toBe('dest')
  })

  it('opens the person while no person is stored, and counts a stored one as answered', () => {
    expect(firstOpenQuestion(3, knowsSomeone)).toBe(PERSON)
    expect(firstOpenQuestion(3, knowsSomeone, null)).toBe(PERSON)
    // With her person stored every asked question is answered: she stays on the last, her person.
    expect(firstOpenQuestion(3, knowsSomeone, cousin)).toBe(PERSON)
  })

  it('does not open the person when it is not asked, and stays on the last asked', () => {
    expect(firstOpenQuestion(3, { ...knowsSomeone, knows: yes('No') })).toBe('knows')
  })

  it('starts step 04 at stay, then its first unanswered, else focus', () => {
    expect(firstOpenQuestion(4, {})).toBe('stay')
    expect(firstOpenQuestion(4, { stay: yes('Yes') })).toBe('focus')
    expect(firstOpenQuestion(4, { stay: yes('Yes'), focus: yes('Academic') })).toBe('focus')
  })

  it('starts step 01 at where, then its first unanswered, assumed counting, else english', () => {
    expect(firstOpenQuestion(1, {})).toBe('where')
    expect(firstOpenQuestion(1, stated('where', 'amount'))).toBe('covers')
    expect(
      firstOpenQuestion(1, {
        where: { value: 'Nepal', state: 'assumed' },
        amount: { value: 30, state: 'assumed' },
      }),
    ).toBe('covers')
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

  it('leaves step 03 for step 04', () => {
    expect(forwardPath(3, {})).toBe('/onboarding/after')
    expect(forwardPath(3, knowsSomeone)).toBe('/onboarding/after')
  })

  it('leaves step 04 for step 05, your attention', () => {
    expect(forwardPath(4, {})).toBe('/onboarding/attention')
    expect(forwardPath(4, { stay: yes('Yes') })).toBe('/onboarding/attention')
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
    expect(shownQuestion(2, '/onboarding/study/areas', studyAnswered(PARTICULAR)).key).toBe('level')
  })

  it('is her first open question when the URL names a hidden one', () => {
    expect(shownQuestion(2, '/onboarding/study/learning', know(SUGGEST_ME)).key).toBe('level')
    expect(shownQuestion(1, '/onboarding/facts/who-pays', stated('where')).key).toBe('amount')
    expect(shownQuestion(4, '/onboarding/after/long-term', {}).key).toBe('stay')
  })
})

describe('stepProgress', () => {
  it('counts a step 02 question among those asked', () => {
    expect(stepProgress('/onboarding/study/know', {})).toEqual({ question: 1, total: 2 })
    expect(stepProgress('/onboarding/study/areas', know(DRAWN_TO_AREAS))).toEqual({
      question: 2,
      total: 3,
    })
    expect(stepProgress('/onboarding/study/level', know(PARTICULAR))).toEqual({
      question: 3,
      total: 3,
    })
  })

  it('counts a step 01 question among the ten', () => {
    expect(stepProgress('/onboarding/facts/amount', {})).toEqual({ question: 2, total: 10 })
  })

  it('reads 1 when the URL names no asked question', () => {
    expect(stepProgress('/onboarding/study', {})).toEqual({ question: 1, total: 2 })
    expect(stepProgress('/onboarding/facts', {})).toEqual({ question: 1, total: 10 })
    expect(stepProgress('/onboarding/study/field', {})).toEqual({ question: 1, total: 2 })
  })

  it('counts the question the screen shows when the URL names one not asked', () => {
    // "Suggest me" asks no field; the screen shows her first open question, the level (2 of 2).
    expect(stepProgress('/onboarding/study/field', know(SUGGEST_ME))).toEqual({
      question: 2,
      total: 2,
    })
  })

  it('counts a step 03 question among those asked, the person included', () => {
    expect(stepProgress('/onboarding/living/destination', {})).toEqual({ question: 1, total: 3 })
    expect(stepProgress('/onboarding/living/who-and-where', knowsSomeone)).toEqual({
      question: 5,
      total: 5,
    })
    // Climate is hidden: the screen shows her first open question, her person.
    expect(stepProgress('/onboarding/living/climate', knowsSomeone)).toEqual({
      question: 5,
      total: 5,
    })
  })

  it('counts a step 04 question among its two', () => {
    expect(stepProgress('/onboarding/after/focus', {})).toEqual({ question: 2, total: 2 })
    expect(stepProgress('/onboarding/after', {})).toEqual({ question: 1, total: 2 })
  })

  it('counts nothing outside the question steps', () => {
    expect(stepProgress('/onboarding/character', {})).toBeNull()
    expect(stepProgress('/onboarding/welcome', {})).toBeNull()
    expect(stepProgress('/futures', {})).toBeNull()
  })

  it('counts nothing on step 05 or the end screen', () => {
    expect(stepProgress('/onboarding/attention', {})).toBeNull()
    expect(stepProgress('/onboarding/done', {})).toBeNull()
  })
})

describe('nextPath', () => {
  it('goes to the next question asked, counting the answer just given', () => {
    // "know" answered "Something particular" asks the field next; without it, level.
    expect(nextPath(2, studyAnswered(PARTICULAR), 'know')).toEqual({
      path: '/onboarding/study/field',
      leaves: false,
    })
    expect(nextPath(1, stated('where'), 'where')).toEqual({
      path: '/onboarding/facts/amount',
      leaves: false,
    })
  })

  it("leaves the step from its last question, to the step's forward path", () => {
    const answers = stated(...KEYS)
    expect(nextPath(1, answers, 'eng')).toEqual({ path: forwardPath(1, answers), leaves: true })
  })

  it('asks for her person after a Yes to knowing someone', () => {
    expect(nextPath(3, knowsSomeone, 'knows')).toEqual({
      path: questionPath(3, PERSON),
      leaves: false,
    })
  })

  it('once her own words answered some of the step, skips to the next open question', () => {
    const { level: _level, ...answers } = studyAnswered(PARTICULAR)
    expect(nextPath(2, answers, 'know', null, true)).toEqual({
      path: questionPath(2, 'level'),
      leaves: false,
    })
    expect(nextPath(2, studyAnswered(PARTICULAR), 'level', null, true).leaves).toBe(true)
  })
})
