import { describe, expect, it } from 'bun:test'
import { feelOf } from './feel'

describe('feelOf (DS-D4)', () => {
  it('feels relieved by what gives when she weighs it 2 or more, else fine', () => {
    expect(feelOf('gives', 2)).toBe('relieved')
    expect(feelOf('gives', 3)).toBe('relieved')
    expect(feelOf('gives', 1)).toBe('fine')
    expect(feelOf('gives', 0)).toBe('fine')
  })

  it('feels fine about what is neutral, whatever the weight', () => {
    expect(feelOf('neutral', 3)).toBe('fine')
    expect(feelOf('neutral', 0)).toBe('fine')
  })

  it('feels a cost as hard at 3, stretched at 2, else fine', () => {
    expect(feelOf('costs', 3)).toBe('hard')
    expect(feelOf('costs', 2)).toBe('stretched')
    expect(feelOf('costs', 1)).toBe('fine')
    expect(feelOf('costs', 0)).toBe('fine')
  })
})

describe('feelOf, the Cost rule', () => {
  it('is at least stretched over budget, whatever the weight', () => {
    expect(feelOf('costs', 1, { budgetK: 30, totalK: 33 })).toBe('stretched')
    expect(feelOf('costs', 0, { budgetK: 30, totalK: 36 })).toBe('stretched')
  })

  it('is hard more than 20% over budget, whatever the weight', () => {
    expect(feelOf('costs', 1, { budgetK: 30, totalK: 37 })).toBe('hard')
    expect(feelOf('costs', 2, { budgetK: 36, totalK: 47 })).toBe('hard')
  })

  it('never softens a feel that is already hard', () => {
    expect(feelOf('costs', 3, { budgetK: 30, totalK: 31 })).toBe('hard')
  })

  it('leaves the DS-D4 feel alone within budget', () => {
    expect(feelOf('gives', 2, { budgetK: 30, totalK: 27 })).toBe('relieved')
    expect(feelOf('neutral', 2, { budgetK: 30, totalK: 30 })).toBe('fine')
  })
})
