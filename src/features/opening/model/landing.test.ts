import { describe, expect, it } from 'bun:test'
import type { Coins, Roadmap, StoredAnswers } from '@/shared/types/student'
import { onboardingResumePath, signedInLanding } from './landing'

/** Questions 1 and 2 of step 01 answered: her first unanswered one is "It covers". */
const twoAnswered: StoredAnswers = {
  where: { value: 'Nepal', state: 'stated' },
  amount: { value: 36, state: 'stated' },
}

const later: Coins = { state: 'later' }
const spent: Coins = { state: 'spent', piles: [2, 1, 2, 1, 1, 1, 1, 1], assumed: false }

/** The roadmap she is answering; the profile mirrors its answers, coins and step. */
const draft: Roadmap = {
  id: 'draft-1',
  name: null,
  answers: twoAnswered,
  relative: null,
  coins: null,
  choices: {},
  lastStep: 'facts',
  copiedFrom: null,
  createdAt: new Date('2026-10-13T09:00:00Z'),
  finishedAt: null,
  lastOpenedAt: null,
}

type Resumable = Parameters<typeof onboardingResumePath>[0]
const student = (p: Partial<Resumable> & Pick<Resumable, 'lastStep'>): Resumable => ({
  persona: 'neutral',
  seenFutures: false,
  answers: twoAnswered,
  coins: null,
  draft,
  finished: 0,
  ...p,
})

/** Answering none, with finished roadmaps: onboarding is closed. */
const done = { draft: null, finished: 1, answers: {}, coins: null } as const

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

  it('open her roadmaps once she is answering none and has finished one, whatever else is stored', () => {
    expect(resume({ lastStep: 'picture', ...done })).toBe('/roadmaps')
    expect(resume({ persona: null, lastStep: 'picture', ...done, finished: 3 })).toBe('/roadmaps')
    expect(resume({ lastStep: 'attention', seenFutures: true, ...done })).toBe('/roadmaps')
    for (const lastStep of ['picture', 'facts', 'living', 'futures', 'attention'] as const)
      for (const coins of [null, later, spent])
        expect(resume({ lastStep, coins })).not.toBe('/roadmaps')
  })

  it('a new student answering none and with none finished opens the welcome, then step 01', () => {
    expect(resume({ persona: null, lastStep: 'picture', draft: null, answers: {} })).toBe(
      '/onboarding/welcome',
    )
    // Step 00 is stored on the profile, not on a roadmap: onboarding stays open after it.
    expect(resume({ lastStep: 'picture', draft: null, answers: {} })).toBe(
      '/onboarding/facts/where',
    )
  })

  it('with a roadmap being answered, resumes it as before, even with others finished', () => {
    expect(resume({ lastStep: 'facts', finished: 2 })).toBe('/onboarding/facts/covers')
    expect(resume({ lastStep: 'attention', coins: later, finished: 2 })).toBe('/onboarding/done')
    expect(resume({ persona: null, lastStep: 'study', finished: 2 })).toBe('/onboarding/welcome')
  })

  it('never send her to the futures', () => {
    for (const lastStep of ['picture', 'facts', 'after', 'futures', 'attention'] as const)
      for (const seenFutures of [false, true])
        for (const coins of [null, later, spent])
          for (const finished of [0, 1])
            expect(resume({ lastStep, seenFutures, coins, finished })).not.toBe('/futures')
  })
})

describe('signedInLanding', () => {
  const land = (asked: string | null, p: Partial<Resumable> = {}) =>
    signedInLanding(student({ lastStep: 'facts', ...p }), asked)

  it('without a page asked for, resumes where she left off', () => {
    expect(land(null)).toBe('/onboarding/facts/covers')
    expect(land(null, done)).toBe('/roadmaps')
  })

  it('sends her to the page asked for', () => {
    expect(land('/onboarding/facts')).toBe('/onboarding/facts')
    expect(land('/roadmaps/r1?tile=perth', done)).toBe('/roadmaps/r1?tile=perth')
  })

  it('once onboarding is closed, an onboarding page asked for is her roadmaps, in one hop', () => {
    expect(land('/onboarding', done)).toBe('/roadmaps')
    expect(land('/onboarding/facts', done)).toBe('/roadmaps')
    expect(land('/onboarding/facts/who-pays?from=mail', done)).toBe('/roadmaps')
    // "You're all set" closes with it.
    expect(land('/onboarding/done', done)).toBe('/roadmaps')
    expect(land('/onboardingx', done)).toBe('/onboardingx')
  })

  it('with a roadmap being answered, an onboarding page asked for opens', () => {
    expect(land('/onboarding/facts', { finished: 2 })).toBe('/onboarding/facts')
  })
})
