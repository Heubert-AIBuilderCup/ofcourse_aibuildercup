import { describe, expect, it } from 'bun:test'
import type { Coins, StoredAnswers } from '@/shared/types/student'
import { onboardingResumePath } from './landing'

/** Questions 1 and 2 of step 01 answered: her first unanswered one is "It covers". */
const twoAnswered: StoredAnswers = {
  where: { value: 'Nepal', state: 'stated' },
  amount: { value: 36, state: 'stated' },
}

const later: Coins = { state: 'later' }
const spent: Coins = { state: 'spent', piles: [2, 1, 2, 1, 1, 1, 1, 1], assumed: false }

type Resumable = Parameters<typeof onboardingResumePath>[0]
const student = (p: Partial<Resumable> & Pick<Resumable, 'lastStep'>): Resumable => ({
  persona: 'neutral',
  seenFutures: false,
  answers: twoAnswered,
  coins: null,
  ...p,
})

const resume = (p: Partial<Resumable> & Pick<Resumable, 'lastStep'>) =>
  onboardingResumePath(student(p))

describe('onboardingResumePath', () => {
  it('open the welcome until she has answered step 00, whatever else is stored', () => {
    expect(resume({ persona: null, lastStep: 'picture', answers: {} })).toBe('/onboarding/welcome')
    expect(resume({ persona: null, lastStep: 'living' })).toBe('/onboarding/welcome')
    expect(resume({ persona: null, lastStep: 'futures', seenFutures: true })).toBe(
      '/onboarding/welcome',
    )
    expect(resume({ persona: null, lastStep: 'attention', coins: spent })).toBe(
      '/onboarding/welcome',
    )
  })

  it('open her first unanswered step 01 question from step 00 or step 01', () => {
    expect(resume({ lastStep: 'picture', answers: {} })).toBe('/onboarding/facts/where')
    expect(resume({ lastStep: 'picture' })).toBe('/onboarding/facts/covers')
    expect(resume({ lastStep: 'facts' })).toBe('/onboarding/facts/covers')
  })

  it('reopen step 02, 03 or 04 when she left from there', () => {
    expect(resume({ lastStep: 'study' })).toBe('/onboarding/study')
    expect(resume({ lastStep: 'living' })).toBe('/onboarding/living')
    expect(resume({ lastStep: 'after' })).toBe('/onboarding/after')
  })

  it('open step 05 from step 05, or from the futures for a student who reached them before', () => {
    expect(resume({ lastStep: 'attention' })).toBe('/onboarding/attention')
    expect(resume({ lastStep: 'futures' })).toBe('/onboarding/attention')
    expect(resume({ lastStep: 'study', seenFutures: true })).toBe('/onboarding/attention')
    expect(resume({ lastStep: 'facts', seenFutures: true })).toBe('/onboarding/attention')
  })

  it('open the end screen once her coins are stored, spent or for later', () => {
    expect(resume({ lastStep: 'attention', coins: later })).toBe('/onboarding/done')
    expect(resume({ lastStep: 'attention', coins: spent })).toBe('/onboarding/done')
    expect(resume({ lastStep: 'study', coins: spent })).toBe('/onboarding/done')
    expect(resume({ lastStep: 'futures', seenFutures: true, coins: later })).toBe(
      '/onboarding/done',
    )
  })

  it('never send her to the futures', () => {
    for (const lastStep of ['picture', 'facts', 'after', 'futures', 'attention'] as const)
      for (const seenFutures of [false, true])
        for (const coins of [null, later, spent])
          expect(resume({ lastStep, seenFutures, coins })).not.toBe('/futures')
  })
})
