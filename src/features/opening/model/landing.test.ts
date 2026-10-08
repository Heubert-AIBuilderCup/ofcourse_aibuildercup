import { describe, expect, it } from 'bun:test'
import type { StoredAnswers } from '@/shared/types/student'
import { landingPath, onboardingResumePath } from './landing'

/** Questions 1 and 2 of step 01 answered: her first unanswered one is "It covers". */
const twoAnswered: StoredAnswers = {
  where: { value: 'Nepal', state: 'stated' },
  amount: { value: 36, state: 'stated' },
}

describe('landingPath', () => {
  it('asks how to picture her before anything else', () => {
    expect(
      landingPath({ persona: null, lastStep: 'picture', seenFutures: false, answers: {} }),
    ).toBe('/onboarding/character')
    expect(landingPath({ persona: null, lastStep: 'living', seenFutures: true, answers: {} })).toBe(
      '/onboarding/character',
    )
  })

  it('opens her first unanswered step 01 question once she has answered the picture question', () => {
    expect(
      landingPath({ persona: 'neutral', lastStep: 'picture', seenFutures: false, answers: {} }),
    ).toBe('/onboarding/facts/where')
    expect(
      landingPath({
        persona: 'neutral',
        lastStep: 'facts',
        seenFutures: false,
        answers: twoAnswered,
      }),
    ).toBe('/onboarding/facts/covers')
  })

  it('reopens the screen she left', () => {
    expect(
      landingPath({ persona: 'female', lastStep: 'living', seenFutures: false, answers: {} }),
    ).toBe('/onboarding/living')
  })

  it('opens her futures once she has seen them, wherever she was', () => {
    expect(
      landingPath({ persona: 'male', lastStep: 'living', seenFutures: true, answers: {} }),
    ).toBe('/futures')
  })

  it('opens her futures from the futures and coins screens', () => {
    expect(
      landingPath({ persona: 'male', lastStep: 'futures', seenFutures: false, answers: {} }),
    ).toBe('/futures')
    expect(
      landingPath({ persona: 'male', lastStep: 'attention', seenFutures: false, answers: {} }),
    ).toBe('/futures')
  })
})

describe('onboardingResumePath', () => {
  const resume = (
    p: Partial<Parameters<typeof onboardingResumePath>[0]> &
      Pick<Parameters<typeof onboardingResumePath>[0], 'lastStep'>,
  ) => onboardingResumePath({ persona: 'neutral', seenFutures: false, answers: twoAnswered, ...p })

  it('opens step 00 until she has answered it, whatever else is stored', () => {
    expect(resume({ persona: null, lastStep: 'picture', answers: {} })).toBe(
      '/onboarding/character',
    )
    expect(resume({ persona: null, lastStep: 'living' })).toBe('/onboarding/character')
    expect(resume({ persona: null, lastStep: 'futures', seenFutures: true })).toBe(
      '/onboarding/character',
    )
  })

  it('opens her first unanswered step 01 question from step 00 or step 01', () => {
    expect(resume({ lastStep: 'picture', answers: {} })).toBe('/onboarding/facts/where')
    expect(resume({ lastStep: 'picture' })).toBe('/onboarding/facts/covers')
    expect(resume({ lastStep: 'facts' })).toBe('/onboarding/facts/covers')
  })

  it('reopens step 02, 03 or 04 when she left from there', () => {
    expect(resume({ lastStep: 'study' })).toBe('/onboarding/study')
    expect(resume({ lastStep: 'living' })).toBe('/onboarding/living')
    expect(resume({ lastStep: 'after' })).toBe('/onboarding/after')
  })

  it('opens step 04, the last onboarding step, from the futures and coins screens', () => {
    expect(resume({ lastStep: 'futures' })).toBe('/onboarding/after')
    expect(resume({ lastStep: 'attention' })).toBe('/onboarding/after')
  })

  it('opens step 04 once she has seen her futures, wherever she was', () => {
    expect(resume({ lastStep: 'study', seenFutures: true })).toBe('/onboarding/after')
    expect(resume({ lastStep: 'facts', seenFutures: true })).toBe('/onboarding/after')
  })
})
