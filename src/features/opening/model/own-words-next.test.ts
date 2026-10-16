import { describe, expect, it } from 'bun:test'
import type { StoredAnswers } from '@/shared/types/student'
import type { OwnWordsChip } from './own-words'
import { afterOwnWords, ownWordsPatch } from './own-words-next'

// Criterion 36: a confirmed chip answers its question, and that question is skipped in the step.

const chip = (over: Partial<OwnWordsChip> & Pick<OwnWordsChip, 'key' | 'value'>): OwnWordsChip => ({
  quote: 'her words',
  needsTap: false,
  change: false,
  ...over,
})

describe('ownWordsPatch', () => {
  it('holds exactly the selected chips, each as a stated answer', () => {
    const chips = [
      chip({ key: 'where', value: 'Nepal' }),
      chip({ key: 'amount', value: 30, needsTap: true }),
      chip({ key: 'covers', value: 'Fees only' }),
    ]
    expect(ownWordsPatch(chips, new Set([0, 2]), {})).toEqual({
      where: { value: 'Nepal', state: 'stated' },
      covers: { value: 'Fees only', state: 'stated' },
    })
  })

  it('leaves out a chip whose question her answers with the patch would not ask', () => {
    const chips = [
      chip({ key: 'know', value: 'Something particular', needsTap: true, change: true }),
      chip({ key: 'field', value: 'Data science' }),
    ]
    const suggest: StoredAnswers = { know: { value: 'Suggest me', state: 'stated' } }
    expect(ownWordsPatch(chips, new Set([1]), suggest)).toEqual({})
    expect(ownWordsPatch(chips, new Set([0, 1]), suggest)).toEqual({
      know: { value: 'Something particular', state: 'stated' },
      field: { value: 'Data science', state: 'stated' },
    })
  })
})

describe('afterOwnWords', () => {
  const know: StoredAnswers = { know: { value: 'Something particular', state: 'stated' } }

  it('goes to the first question still unanswered in the step once the chips are stored', () => {
    const patch = ownWordsPatch(
      [chip({ key: 'field', value: 'Data science' }), chip({ key: 'level', value: "Master's" })],
      new Set([0, 1]),
      know,
    )
    expect(afterOwnWords('study', { ...know, ...patch }, null)).toBe('/onboarding/study/learning')
  })

  it("goes to the step's last question when every one is answered", () => {
    const answers: StoredAnswers = {
      ...know,
      field: { value: 'Data science', state: 'stated' },
      level: { value: "Master's", state: 'stated' },
      learn: { value: 'No preference', state: 'stated' },
      length: { value: 'As short as possible', state: 'stated' },
    }
    expect(afterOwnWords('study', answers, null)).toBe('/onboarding/study/length')
  })

  it('opens her person on living while none is stored, after a Yes to knowing someone', () => {
    const answers: StoredAnswers = {
      dest: { value: 'Australia', state: 'stated' },
      place: { value: 'City', state: 'stated' },
      community: { value: 'Yes', state: 'stated' },
      knows: { value: 'Yes', state: 'stated' },
    }
    expect(afterOwnWords('living', answers, null)).toBe('/onboarding/living/who-and-where')
  })
})
