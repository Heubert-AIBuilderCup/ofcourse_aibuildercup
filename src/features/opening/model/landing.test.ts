import { describe, expect, it } from 'bun:test'
import type { Coins, StoredAnswers } from '@/shared/types/student'
import { onboardingResumePath, signedInLanding } from './landing'

/** Questions 1 and 2 of step 01 answered: her first unanswered one is "It covers". */
const twoAnswered: StoredAnswers = {
  where: { value: 'Nepal', state: 'stated' },
  amount: { value: 36, state: 'stated' },
}

const later: Coins = { state: 'later' }
/** When she pressed "Go to your road". */
const finished = new Date('2026-10-13T09:00:00Z')
const spent: Coins = { state: 'spent', piles: [2, 1, 2, 1, 1, 1, 1, 1], assumed: false }

type Resumable = Parameters<typeof onboardingResumePath>[0]
const student = (p: Partial<Resumable> & Pick<Resumable, 'lastStep'>): Resumable => ({
  persona: 'neutral',
  seenFutures: false,
  answers: twoAnswered,
  coins: null,
  onboardedAt: null,
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

  it('open the end once her coins are stored, spent or for later, until she goes to her road', () => {
    expect(resume({ lastStep: 'attention', coins: later })).toBe('/onboarding/done')
    expect(resume({ lastStep: 'attention', coins: spent })).toBe('/onboarding/done')
    expect(resume({ lastStep: 'study', coins: spent })).toBe('/onboarding/done')
    expect(resume({ lastStep: 'futures', seenFutures: true, coins: later })).toBe(
      '/onboarding/done',
    )
  })

  it('open her road only once she has gone to it, whatever else is stored', () => {
    expect(resume({ lastStep: 'attention', coins: later, onboardedAt: finished })).toBe('/road')
    expect(resume({ lastStep: 'study', coins: spent, onboardedAt: finished })).toBe('/road')
    expect(
      resume({ persona: null, lastStep: 'attention', coins: spent, onboardedAt: finished }),
    ).toBe('/road')
    for (const lastStep of ['picture', 'facts', 'living', 'futures', 'attention'] as const)
      for (const coins of [null, later, spent])
        expect(resume({ lastStep, coins })).not.toBe('/road')
  })

  it('never send her to the futures', () => {
    for (const lastStep of ['picture', 'facts', 'after', 'futures', 'attention'] as const)
      for (const seenFutures of [false, true])
        for (const coins of [null, later, spent])
          for (const onboardedAt of [null, finished])
            expect(resume({ lastStep, seenFutures, coins, onboardedAt })).not.toBe('/futures')
  })
})

describe('signedInLanding', () => {
  const land = (asked: string | null, p: Partial<Resumable> = {}) =>
    signedInLanding(student({ lastStep: 'facts', ...p }), asked)

  it('without a page asked for, resumes where she left off', () => {
    expect(land(null)).toBe('/onboarding/facts/covers')
    expect(land(null, { coins: later, onboardedAt: finished })).toBe('/road')
  })

  it('sends her to the page asked for', () => {
    expect(land('/onboarding/facts')).toBe('/onboarding/facts')
    expect(land('/road?tile=perth', { coins: later, onboardedAt: finished })).toBe(
      '/road?tile=perth',
    )
  })

  it('once she is on her road, an onboarding page asked for is her road, in one hop', () => {
    const done = { coins: later, onboardedAt: finished }
    expect(land('/onboarding', done)).toBe('/road')
    expect(land('/onboarding/facts', done)).toBe('/road')
    expect(land('/onboarding/facts/who-pays?from=mail', done)).toBe('/road')
    // "You're all set" stays open after it, for now.
    expect(land('/onboarding/done', done)).toBe('/onboarding/done')
    expect(land('/onboardingx', done)).toBe('/onboardingx')
  })
})
