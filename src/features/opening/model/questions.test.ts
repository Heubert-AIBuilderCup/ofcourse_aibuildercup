import { describe, expect, it } from 'bun:test'
import {
  QUESTION_KEYS,
  type Relative,
  type StoredAnswer,
  type StoredAnswers,
} from '@/shared/types/student'
import {
  activeRelative,
  chipText,
  DEFAULTS,
  editLabel,
  effective,
  fieldsChosen,
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
  it('are the four opening steps, numbered 1 to 4', () => {
    expect(SCREENS.map((screen) => screen.step)).toEqual(['facts', 'study', 'living', 'after'])
    expect(SCREENS.map((screen) => screen.number)).toEqual([1, 2, 3, 4])
    expect(SCREENS.map((screen) => screen.next)).toEqual([
      "Next: what you'd study",
      "Next: where and how you'd live",
      'Next: after you graduate',
      'Show me three futures',
    ])
  })

  it('ask every question exactly once', () => {
    const keys = SCREENS.flatMap((_, i) => keysOf(i))
    expect([...keys].sort()).toEqual([...QUESTION_KEYS].sort())
  })

  it('ask on screen 1 where she is, her budget, timing, who comes, and her scores', () => {
    expect(keysOf(0)).toEqual([
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
    ])
    expect(SCREENS[0].items.map((item) => item.title)).toEqual([
      'Where are you right now?',
      'Your budget per year',
      'Timing',
      'Anyone coming with you?',
      'Your qualifications and scores',
    ])
  })

  it('offer every country, ending with a visa in Australia and another country', () => {
    const where = questionOf('where')
    expect(where.control).toBe('select')
    expect(where.options.slice(-2)).toEqual(['Australia (on a visa)', 'Another country'])
    expect(where.options).toHaveLength(12)
  })

  it('offer partner and children on "Anyone coming with you?"', () => {
    expect(questionOf('dep').options).toEqual(['No one', 'Partner', 'Partner and children'])
  })

  it('offer "Open to others" as a destination', () => {
    expect(questionOf('dest').options).toEqual(['Australia', 'Open to others'])
  })

  it('offer yes, not sure and no on staying, where "Not sure" is a real answer', () => {
    expect(questionOf('stay').options).toEqual(['Yes', 'Not sure', 'No'])
    expect(questionOf('stay').notSure).toBe(false)
  })

  it('let areas be picked up to three, with no "Not sure"', () => {
    expect(questionOf('areas').control).toBe('multi')
    expect(questionOf('areas').notSure).toBe(false)
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

describe('fieldsChosen', () => {
  it('is any field when nothing is answered', () => {
    expect(fieldsChosen({})).toEqual({ kind: 'any', values: [] })
  })

  it('is the field she knows', () => {
    expect(fieldsChosen({ know: s('Something particular'), field: s('Cyber security') })).toEqual({
      kind: 'field',
      values: ['Cyber security'],
    })
  })

  it('is any field when she knows something particular but has not said which', () => {
    expect(fieldsChosen({ know: s('Something particular') })).toEqual({ kind: 'any', values: [] })
    expect(fieldsChosen({ know: s('Something particular'), field: assumed('Any') })).toEqual({
      kind: 'any',
      values: [],
    })
  })

  it('is the areas she is drawn to', () => {
    expect(
      fieldsChosen({ know: s("A few areas I'm drawn to"), areas: s(['IT and computing', 'Data']) }),
    ).toEqual({ kind: 'areas', values: ['IT and computing', 'Data'] })
  })

  it('ignores a field left over once she says "Suggest me"', () => {
    expect(fieldsChosen({ know: s('Suggest me'), field: s('Cyber security') })).toEqual({
      kind: 'any',
      values: [],
    })
  })
})

describe('chipText', () => {
  it('says the budget, marked assumed when unanswered', () => {
    expect(chipText('amount', {})).toBe('Assumed: Budget about AUD 30k a year')
    expect(chipText('amount', { amount: s(36) })).toBe('Budget about AUD 36k a year')
  })

  it('says whether she wants to stay', () => {
    expect(chipText('stay', { stay: s('Yes') })).toBe('Wants to stay after')
    expect(chipText('stay', { stay: s('Not sure') })).toBe('Not sure about staying')
    expect(chipText('stay', { stay: s('No') })).toBe('Not staying after')
    expect(chipText('stay', {})).toBe('Assumed: Not sure about staying')
  })

  it('reads every other chip as the design does', () => {
    expect(chipText('hard', { hard: s('Hard limit') })).toBe('A hard limit')
    expect(chipText('hard', { hard: assumed('Roughly') })).toBe('Assumed: A rough budget')
    expect(chipText('covers', { covers: s('Fees and living') })).toBe('Fees and living')
    expect(chipText('place', { place: s('Regional') })).toBe('Prefers regional')
    expect(chipText('latest', { latest: s('Feb 2028') })).toBe('Latest start Feb 2028')
    expect(chipText('earn', { earn: s('Helpful') })).toBe('Earning while studying: helpful')
    expect(chipText('level', { level: s("Bachelor's") })).toBe("Level: Bachelor's")
    expect(chipText('dest', { dest: s('Australia') })).toBe('Australia only')
    expect(chipText('dest', { dest: s('Open to others') })).toBe('Open to others · Australia shown')
  })

  it('names the question where the bare answer would not say what it answers', () => {
    expect(chipText('who', {})).toBe('Assumed: Who pays: family')
    expect(chipText('learn', {})).toBe('Assumed: Learning: no preference')
    expect(chipText('community', {})).toBe('Assumed: Community nearby: a little')
    expect(chipText('focus', {})).toBe('Assumed: Career-focused')
  })

  it('names the field, the areas, or any field', () => {
    expect(chipText('field', { know: s('Something particular'), field: s('Cyber security') })).toBe(
      'Field: Cyber security',
    )
    expect(
      chipText('field', {
        know: s("A few areas I'm drawn to"),
        areas: s(['IT and computing', 'Data']),
      }),
    ).toBe('Areas: IT and computing, Data')
    expect(chipText('field', {})).toBe('Assumed: Field: any (suggest me)')
  })

  it('does not mark "Suggest me" assumed once she said it', () => {
    expect(chipText('field', { know: s('Suggest me') })).toBe('Field: any (suggest me)')
    expect(chipText('field', { know: s('Something particular'), field: assumed('Any') })).toBe(
      'Assumed: Field: any (suggest me)',
    )
  })
})

describe('editLabel', () => {
  it('names the budget and the field as the chip editor heads them', () => {
    expect(editLabel('amount')).toBe('Your budget per year')
    expect(editLabel('field')).toBe("What you'd study")
  })

  it("is the question's label, or the item's title where the title asks it", () => {
    expect(editLabel('hard')).toBe('Is this a hard limit, or roughly?')
    expect(editLabel('latest')).toBe("Latest you'd accept")
    expect(editLabel('stay')).toBe('Would you want to stay after?')
    expect(editLabel('level')).toBe('Study level')
    expect(editLabel('place')).toBe('Kind of place')
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
