import { describe, expect, it } from 'bun:test'
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
      why: 'It decides which cities stay open on each route. A rough number is fine.',
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

  it('shows a skipped optional question as "Skipped", with no answer', () => {
    const gs = groups()
    expect(row(gs, 'climate')).toMatchObject({ shown: '', open: 'Skipped', editable: true })
    expect(row(gs, 'settle')).toMatchObject({ shown: '', open: 'Skipped' })
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

  it('any other answer changes nothing on the roadmap', () => {
    expect(effectOf(road, 'climate', 'Warm', {})).toEqual(NONE)
    expect(effectOf(road, 'where', 'India', {})).toEqual(NONE)
  })
})
