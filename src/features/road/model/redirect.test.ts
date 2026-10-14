import { describe, expect, it } from 'bun:test'
import type { Coins } from '@/shared/types/student'
import { roadRedirect } from './redirect'

type Profile = Parameters<typeof roadRedirect>[0]
const student = (p: Partial<Profile>): Profile => ({
  persona: 'neutral',
  lastStep: 'attention',
  seenFutures: true,
  answers: {},
  coins: null,
  onboardedAt: null,
  ...p,
})

const later: Coins = { state: 'later' }
const spent: Coins = { state: 'spent', piles: [2, 1, 2, 1, 1, 1, 1, 1], assumed: false }
/** When she pressed "Go to your road". */
const finished = new Date('2026-10-13T09:00:00Z')

describe('roadRedirect', () => {
  it('lets a student onto her road once she has gone to it, coins spent or left for later', () => {
    expect(roadRedirect(student({ coins: spent, onboardedAt: finished }))).toBeNull()
    expect(roadRedirect(student({ coins: later, onboardedAt: finished }))).toBeNull()
  })

  it('sends a student whose coins are stored but who has not gone to her road to the end', () => {
    expect(roadRedirect(student({ coins: spent }))).toBe('/onboarding/done')
    expect(roadRedirect(student({ coins: later }))).toBe('/onboarding/done')
  })

  it('sends a student who has not finished back to where she left off in onboarding', () => {
    expect(roadRedirect(student({}))).toBe('/onboarding/attention')
    expect(roadRedirect(student({ lastStep: 'living', seenFutures: false }))).toBe(
      '/onboarding/living',
    )
    expect(roadRedirect(student({ persona: null, coins: spent }))).toBe('/onboarding/welcome')
  })
})
