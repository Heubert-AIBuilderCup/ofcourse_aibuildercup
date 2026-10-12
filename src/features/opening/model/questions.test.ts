import { describe, expect, it } from 'bun:test'
import {
  QUESTION_KEYS,
  type Relative,
  type StoredAnswer,
  type StoredAnswers,
} from '@/shared/types/student'
import {
  activeRelative,
  DEFAULTS,
  effective,
  isAssumed,
  isVisible,
  parseAnswer,
  questionOf,
  SCREENS,
} from './questions'

const s = (value: StoredAnswer['value']): StoredAnswer => ({ value, state: 'stated' })
const assumed = (value: StoredAnswer['value']): StoredAnswer => ({ value, state: 'assumed' })
const keysOf = (i: number) => SCREENS[i].items.flatMap((item) => item.questions.map((q) => q.key))

describe('SCREENS', () => {
  it('ask every question exactly once', () => {
    const keys = SCREENS.flatMap((_, i) => keysOf(i))
    expect([...keys].sort()).toEqual([...QUESTION_KEYS].sort())
  })

  it('ask on screen 3 one question per item, so community and knowing someone each have a line', () => {
    for (const item of SCREENS[2].items) {
      expect(item.questions.map((q): string => q.key)).toEqual([item.id])
    }
  })

  it('give a default to every question that offers "Not sure"', () => {
    for (const key of QUESTION_KEYS) {
      if (questionOf(key).notSure) expect(DEFAULTS[key]).toBeDefined()
    }
  })
})

describe('isVisible', () => {
  it('shows the field only when she knows something particular', () => {
    expect(isVisible('field', {})).toBe(false)
    expect(isVisible('field', { know: s('Something particular') })).toBe(true)
  })

  it('shows the areas only when she is drawn to a few', () => {
    expect(isVisible('areas', {})).toBe(false)
    expect(isVisible('areas', { know: s("A few areas I'm drawn to") })).toBe(true)
  })

  it('asks whether she knows anyone only once community is answered other than No', () => {
    expect(isVisible('knows', {})).toBe(false)
    expect(isVisible('knows', { community: s('A little') })).toBe(true)
    expect(isVisible('knows', { community: s('No') })).toBe(false)
    expect(isVisible('knows', { community: assumed('A little') })).toBe(true)
  })

  it('shows every other question always', () => {
    expect(isVisible('amount', {})).toBe(true)
    expect(isVisible('community', {})).toBe(true)
  })
})

describe('parseAnswer', () => {
  it('stores an option as stated', () => {
    expect(parseAnswer('amount', 36)).toEqual(s(36))
    expect(parseAnswer('dep', 'Partner')).toEqual(s('Partner'))
  })

  it('refuses a value that is not an option', () => {
    expect(parseAnswer('amount', 37)).toBeNull()
    expect(parseAnswer('amount', '36')).toBeNull()
    expect(parseAnswer('dest', 'Canada')).toBeNull()
    expect(parseAnswer('where', undefined)).toBeNull()
  })

  it('stores the default, marked assumed, for "Not sure"', () => {
    expect(parseAnswer('amount', 'Not sure')).toEqual({ value: 30, state: 'assumed' })
    expect(parseAnswer('qual', 'Not sure')).toEqual(assumed('Unknown'))
  })

  it('refuses "Not sure" where it is not offered, and stores it where it is an option', () => {
    expect(parseAnswer('climate', 'Not sure')).toBeNull()
    expect(parseAnswer('stay', 'Not sure')).toEqual(s('Not sure'))
  })

  it('takes one to three distinct areas', () => {
    expect(parseAnswer('areas', ['Data', 'Health'])).toEqual(s(['Data', 'Health']))
    expect(parseAnswer('areas', ['Data', 'Health', 'Business', 'Design'])).toBeNull()
    expect(parseAnswer('areas', [])).toBeNull()
    expect(parseAnswer('areas', ['Data', 'Data'])).toBeNull()
    expect(parseAnswer('areas', ['Data', 'Cooking'])).toBeNull()
    expect(parseAnswer('areas', 'Data')).toBeNull()
  })

  it('takes back a stored answer (Undo): stated on an option, assumed on the default', () => {
    expect(parseAnswer('amount', s(36))).toEqual(s(36))
    expect(parseAnswer('amount', assumed(30))).toEqual(assumed(30))
    expect(parseAnswer('stay', assumed('Not sure'))).toEqual(assumed('Not sure'))
    expect(parseAnswer('field', assumed('Any'))).toEqual(assumed('Any'))
    expect(parseAnswer('areas', s(['Data']))).toEqual(s(['Data']))
  })

  it('refuses a stored answer that is neither', () => {
    expect(parseAnswer('amount', s(37))).toBeNull()
    expect(parseAnswer('amount', assumed(36))).toBeNull()
    expect(parseAnswer('qual', s('Unknown'))).toBeNull()
    expect(parseAnswer('climate', assumed('Mild'))).toBeNull()
    expect(parseAnswer('amount', { value: 36, state: 'maybe' })).toBeNull()
  })

  it('keeps only the value and the state of a stored answer', () => {
    expect(parseAnswer('amount', { value: 36, state: 'stated', extra: 1 })).toEqual(s(36))
  })
})

describe('effective and isAssumed', () => {
  it('fall back to the default when unanswered', () => {
    expect(effective({}, 'amount')).toBe(30)
    expect(isAssumed({}, 'amount')).toBe(true)
  })

  it('use a stated answer, which is not assumed', () => {
    const answers: StoredAnswers = { amount: s(36) }
    expect(effective(answers, 'amount')).toBe(36)
    expect(isAssumed(answers, 'amount')).toBe(false)
  })

  it('use an assumed answer, which is assumed', () => {
    const answers: StoredAnswers = { hard: assumed('Roughly') }
    expect(effective(answers, 'hard')).toBe('Roughly')
    expect(isAssumed(answers, 'hard')).toBe(true)
  })

  it('leave a question with no default unanswered, and not assumed', () => {
    expect(effective({}, 'climate')).toBeUndefined()
    expect(isAssumed({}, 'climate')).toBe(false)
  })
})

describe('activeRelative', () => {
  const anjali: Relative = {
    placeId: 'cannington',
    place: 'Cannington',
    relationship: 'Cousin',
    name: 'Anjali',
  }

  it('keeps her person while she says she knows someone, and that question still shows', () => {
    expect(activeRelative({ community: s('A little'), knows: s('Yes') }, anjali)).toBe(anjali)
    expect(activeRelative({ community: assumed('A little'), knows: s('Yes') }, anjali)).toBe(anjali)
  })

  it('drops her person once community is No, though the stored "Yes" stays behind', () => {
    expect(activeRelative({ community: s('No'), knows: s('Yes') }, anjali)).toBeNull()
  })

  it('drops her person when she knows no one, or has not said', () => {
    expect(activeRelative({ community: s('Yes'), knows: s('No') }, anjali)).toBeNull()
    expect(activeRelative({ community: s('Yes') }, anjali)).toBeNull()
    expect(activeRelative({}, anjali)).toBeNull()
  })

  it('is null when no one was named', () => {
    expect(activeRelative({ community: s('Yes'), knows: s('Yes') }, null)).toBeNull()
  })
})
