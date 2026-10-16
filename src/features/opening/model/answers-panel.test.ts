import { describe, expect, it, mock } from 'bun:test'
// The road's data straight from its model: the test needs Priya's road, not the board.
import { getRoad } from '@/features/road/model/road-data'
import type { Relative, StoredAnswers } from '@/shared/types/student'
import {
  type AnswerGroup,
  type AnswerRow,
  answerGroups,
  answerLabel,
  effectOf,
  optionsFor,
} from './answers-panel'
import { DRAWN_TO_AREAS, PARTICULAR } from './questions'

const road = getRoad()
const CYBER = 'cyber-security-ecu-perth'
const NONE = { lines: ['Nothing on your roadmap changes.'], prev: {} }

const ANJALI: Relative = {
  placeId: 'cannington',
  place: 'Cannington, Perth',
  relationship: 'Cousin',
  name: 'Anjali',
}

const groups = (answers: StoredAnswers = {}, more: { relative?: Relative | null } = {}) =>
  answerGroups(answers, more.relative ?? null)

const rows = (gs: AnswerGroup[]): AnswerRow[] => gs.flatMap((g) => g.rows)
const row = (gs: AnswerGroup[], key: string) => rows(gs).find((r) => r.key === key)

describe('answerGroups', () => {
  it('gives only the four steps whose questions draw the board, numbered 01 to 04', () => {
    expect(groups().map((g) => [g.n, g.name])).toEqual([
      ['01', 'Facts about you'],
      ['02', "What you'd study"],
      ['03', "Where and how you'd live"],
      ['04', 'After you graduate'],
    ])
    // Her character is her profile's and her coins never move the road: neither is a row.
    const keys = rows(groups()).map((r) => r.key)
    expect(keys).not.toContain('character')
    expect(keys).not.toContain('coins')
  })

  it("shows a stated answer by its label, with the question's why and its options", () => {
    const gs = groups({
      amount: { value: 36, state: 'stated' },
      where: { value: 'India', state: 'stated' },
    })
    expect(row(gs, 'amount')).toMatchObject({
      shown: 'AUD 36k',
      open: null,
      editable: true,
      why: 'A course on your road that costs more is marked over budget, and its city a stretch. A rough number is fine.',
      options: optionsFor('amount'),
    })
    expect(row(gs, 'where')).toMatchObject({ shown: 'India', open: null })
  })

  it("names a question of a several-question item after the item: 'Your budget per year · Amount'", () => {
    expect(row(groups(), 'amount')?.question).toBe('Your budget per year · Amount')
    expect(row(groups(), 'where')?.question).toBe('Where are you right now?')
  })

  it('shows an assumed answer, or an unanswered one with a default, as its default " · assumed"', () => {
    const gs = groups({ amount: { value: 30, state: 'assumed' } })
    expect(row(gs, 'amount')).toMatchObject({ shown: 'AUD 30k · assumed', open: null })
    expect(row(gs, 'hard')).toMatchObject({ shown: 'Roughly · assumed', open: null })
  })

  it('shows a skipped question with no default as "Skipped", with no answer', () => {
    const gs = groups({ know: { value: DRAWN_TO_AREAS, state: 'stated' } })
    expect(row(gs, 'areas')).toMatchObject({ shown: '', open: 'Skipped', editable: true })
  })

  it('leaves out the six hidden questions, even with an answer stored for each (16 Oct 2026)', () => {
    const hidden = ['who', 'learn', 'length', 'climate', 'earn', 'settle'] as const
    const stored: StoredAnswers = Object.fromEntries(
      hidden.map((key) => [key, { value: 'x', state: 'stated' }]),
    )
    const keys = rows(groups(stored)).map((r) => r.key)
    for (const key of hidden) expect(keys).not.toContain(key)
  })

  it('leaves out the questions not asked for these answers', () => {
    const keys = (answers: StoredAnswers) => rows(groups(answers)).map((r) => r.key)
    expect(keys({})).not.toContain('field')
    expect(keys({})).not.toContain('areas')
    expect(keys({})).not.toContain('knows')
    const particular = keys({ know: { value: PARTICULAR, state: 'stated' } })
    expect(particular).toContain('field')
    expect(particular).not.toContain('areas')
    expect(keys({ know: { value: DRAWN_TO_AREAS, state: 'stated' } })).toContain('areas')
  })

  it('shows her person as "<name>, <relationship> · <place>", not changeable here', () => {
    const answers: StoredAnswers = {
      community: { value: 'Yes', state: 'stated' },
      knows: { value: 'Yes', state: 'stated' },
    }
    expect(row(groups(answers, { relative: ANJALI }), 'person')).toMatchObject({
      question: 'Who, and where?',
      shown: 'Anjali, cousin · Cannington, Perth',
      open: null,
      editable: false,
      options: [],
    })
    expect(row(groups(answers), 'person')).toMatchObject({ shown: '', open: 'Skipped' })
    // Not asked unless she knows someone.
    expect(row(groups({}, { relative: ANJALI }), 'person')).toBeUndefined()
  })
})

describe('optionsFor and answerLabel', () => {
  it('labels amounts "AUD 24k" and offers "Not sure" where the question does', () => {
    expect(optionsFor('amount')).toEqual([
      { value: 24, label: 'AUD 24k' },
      { value: 30, label: 'AUD 30k' },
      { value: 36, label: 'AUD 36k' },
      { value: 42, label: 'AUD 42k' },
      { value: 'Not sure', label: 'Not sure' },
    ])
    expect(optionsFor('climate').map((o) => o.label)).toEqual(['Mild', 'Warm', 'No preference'])
  })

  it('reads any other answer as itself, areas joined', () => {
    expect(answerLabel('amount', 30)).toBe('AUD 30k')
    expect(answerLabel('covers', 'Fees only')).toBe('Fees only')
    expect(answerLabel('areas', ['Data', 'Health'])).toBe('Data, Health')
  })
})

describe('effectOf', () => {
  it('a budget under the course’s fees marks its city a stretch and the course over budget', () => {
    expect(effectOf(road, 'amount', 30, {})).toEqual({
      lines: [
        'Perth is marked as a stretch on your budget.',
        'Cyber Security goes AUD 3.5k a year over it.',
      ],
      prev: { perth: 'A stretch on your budget', [CYBER]: 'AUD 3.5k a year over budget' },
    })
    expect(effectOf(road, 'amount', 24, {})).toEqual({
      lines: [
        'Perth is marked as a stretch on your budget.',
        'Cyber Security goes AUD 9.5k a year over it.',
      ],
      prev: { perth: 'A stretch on your budget', [CYBER]: 'AUD 9.5k a year over budget' },
    })
  })

  it('reads the fees from the road it is given', () => {
    const cheaper = {
      ...road,
      tiles: road.tiles.map((t) => (t.id === CYBER ? { ...t, fees: 25 } : t)),
    }
    expect(effectOf(cheaper, 'amount', 24, {}).prev).toEqual({
      perth: 'A stretch on your budget',
      [CYBER]: 'AUD 1k a year over budget',
    })
    expect(effectOf(cheaper, 'amount', 30, {}).prev).toEqual({})
  })

  it('a budget that covers the fees moves nothing', () => {
    expect(effectOf(road, 'amount', 42, {})).toEqual({
      lines: ['Nothing on your roadmap moves.'],
      prev: {},
    })
  })

  it('a budget that covers the fees again, after one under them was saved, lifts the marks', () => {
    const saved: StoredAnswers = { amount: { value: 30, state: 'stated' } }
    expect(effectOf(road, 'amount', 42, saved)).toEqual({
      lines: ['Perth is no longer a stretch on your budget.', 'Cyber Security fits your budget.'],
      prev: { perth: 'No longer a stretch', [CYBER]: 'Within your budget' },
    })
  })

  it('"Not sure" previews the assumed AUD 30k', () => {
    expect(effectOf(road, 'amount', 'Not sure', {})).toEqual(effectOf(road, 'amount', 30, {}))
  })

  it('"Not taken yet" on the English test breaks the course’s entry condition', () => {
    expect(effectOf(road, 'eng', 'Not taken yet', {})).toEqual({
      lines: ['Cyber Security’s entry condition is no longer met: it asks for IELTS 6.5 by March.'],
      prev: { [CYBER]: 'Needs IELTS 6.5 by March' },
    })
    expect(effectOf(road, 'eng', 'IELTS 7.0', {})).toEqual(NONE)
  })

  it('reads the course’s own score: a score below it breaks the condition, and the line never says "Not met" (criterion 102)', () => {
    // A built road whose course asks 7.0 and whose saved answer already falls short of it.
    const asks7 = {
      ...road,
      badges: {
        ...road.badges,
        ielts: { ...road.badges.ielts, value: 'Not met: IELTS 7.0 overall' },
      },
      tiles: road.tiles.map((t) => (t.id === CYBER ? { ...t, ielts: 7 } : t)),
    }
    const breaks = {
      lines: ['Cyber Security’s entry condition is no longer met: it asks for IELTS 7.0 overall.'],
      prev: { [CYBER]: 'Needs IELTS 7.0 overall' },
    }
    expect(effectOf(asks7, 'eng', 'PTE 50', {})).toEqual(breaks)
    expect(effectOf(asks7, 'eng', 'Not taken yet', {})).toEqual(breaks)
    expect(effectOf(asks7, 'eng', 'IELTS 7.0', {})).toEqual(NONE)
  })

  it('says the condition stays unmet when her saved answer already fell short, never "no longer met"', () => {
    const asks7 = {
      ...road,
      tiles: road.tiles.map((t) => (t.id === CYBER ? { ...t, ielts: 7 } : t)),
    }
    const savedShort: StoredAnswers = { eng: { value: 'PTE 50', state: 'stated' } }
    expect(effectOf(asks7, 'eng', 'PTE 52', savedShort)).toEqual({
      lines: ['Cyber Security’s entry condition is still not met: it asks for IELTS 7.0 overall.'],
      prev: { [CYBER]: 'Needs IELTS 7.0 overall' },
    })
    const notTaken: StoredAnswers = { eng: { value: 'Not taken yet', state: 'stated' } }
    expect(effectOf(road, 'eng', 'Not taken yet', notTaken).lines).toEqual([
      'Cyber Security’s entry condition is still not met: it asks for IELTS 6.5 by March.',
    ])
    // A saved answer that met it: the pick breaks it.
    const savedMet: StoredAnswers = { eng: { value: 'IELTS 7.0', state: 'stated' } }
    expect(effectOf(asks7, 'eng', 'PTE 52', savedMet).lines).toEqual([
      'Cyber Security’s entry condition is no longer met: it asks for IELTS 7.0 overall.',
    ])
  })

  it('any other answer changes nothing on the roadmap', () => {
    expect(effectOf(road, 'climate', 'Warm', {})).toEqual(NONE)
    expect(effectOf(road, 'where', 'India', {})).toEqual(NONE)
  })
})

describe('effectOf, re-matching her road', () => {
  const answers: StoredAnswers = { field: { value: 'Cyber security', state: 'stated' } }
  /** The board's rule, stubbed: a field of Data science moves her road; nothing else does. */
  const rematch = mock((_before: StoredAnswers, after: StoredAnswers) =>
    after.field?.value === 'Data science'
      ? 'Your road changes to Sydney · Data Science · 186.'
      : null,
  )

  it('asks the board with her saved answers, and them with the pick stored as onboarding stores it', () => {
    effectOf(road, 'field', 'Data science', answers, rematch)
    expect(rematch).toHaveBeenLastCalledWith(answers, {
      field: { value: 'Data science', state: 'stated' },
    })
  })

  it('puts the road a change moves her to first', () => {
    expect(effectOf(road, 'field', 'Data science', answers, rematch)).toEqual({
      lines: ['Your road changes to Sydney · Data Science · 186.'],
      prev: {},
    })
  })

  it('a change that moves neither her road nor a tile says her road stays', () => {
    expect(effectOf(road, 'climate', 'Warm', answers, rematch)).toEqual({
      lines: ['Nothing on your road moves.'],
      prev: {},
    })
  })

  it('a budget change keeps its own lines and adds no road line', () => {
    for (const value of [24, 30, 42, 'Not sure']) {
      expect(effectOf(road, 'amount', value, answers, rematch)).toEqual(
        effectOf(road, 'amount', value, answers),
      )
    }
    expect(effectOf(road, 'eng', 'Not taken yet', answers, rematch)).toEqual(
      effectOf(road, 'eng', 'Not taken yet', answers),
    )
  })

  it('without rematch, a change of road says nothing of it (the switch is off)', () => {
    expect(effectOf(road, 'field', 'Data science', answers)).toEqual(NONE)
    expect(effectOf(road, 'climate', 'Warm', answers)).toEqual(NONE)
  })
})
