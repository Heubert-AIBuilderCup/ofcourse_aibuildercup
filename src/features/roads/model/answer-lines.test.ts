// Her answers as the why and Ask are given them (criterion 68): amounts in AUD, defaults marked.
// Pure.

import { describe, expect, it } from 'bun:test'
import type { StoredAnswers } from '@/shared/types/student'
import { answerLines } from './answer-lines'

describe('answerLines (68)', () => {
  it('writes her budget as "AUD 30k a year", under the question she read', () => {
    const answers: StoredAnswers = { amount: { value: 30, state: 'stated' } }
    expect(answerLines(answers)).toEqual([
      { question: 'Your budget per year', answer: 'AUD 30k a year' },
    ])
  })

  it('marks an assumed answer as a default', () => {
    const answers: StoredAnswers = {
      amount: { value: 30, state: 'assumed' },
      stay: { value: 'Yes', state: 'assumed' },
      level: { value: "Master's", state: 'stated' },
    }
    expect(answerLines(answers)).toEqual([
      { question: 'Your budget per year', answer: 'AUD 30k a year, assumed' },
      { question: 'Study level', answer: "Master's" },
      { question: 'Would you want to stay after?', answer: 'Yes, assumed' },
    ])
  })

  it('leaves out a question she never answered and one her answers hide', () => {
    const answers: StoredAnswers = {
      know: { value: 'Suggest me', state: 'stated' },
      field: { value: 'Data science', state: 'stated' },
    }
    expect(answerLines(answers)).toEqual([
      { question: 'Do you know what you want to study?', answer: 'Suggest me' },
    ])
  })
})
