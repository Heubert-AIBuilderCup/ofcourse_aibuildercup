import { describe, expect, it } from 'bun:test'
import type { Coins, Roadmap } from '@/shared/types/student'
import { roadRedirect } from './redirect'

const draft: Roadmap = {
  id: 'draft-1',
  name: null,
  answers: {},
  relative: null,
  coins: null,
  choices: {},
  ownWords: {},
  tags: [],
  lastStep: 'attention',
  copiedFrom: null,
  createdAt: new Date('2026-10-13T09:00:00Z'),
  finishedAt: null,
  lastOpenedAt: null,
  archivedAt: null,
}

type Profile = Parameters<typeof roadRedirect>[0]
const student = (p: Partial<Profile>): Profile => ({
  persona: 'neutral',
  lastStep: 'attention',
  seenFutures: true,
  answers: {},
  coins: null,
  draft,
  finished: 0,
  ...p,
})

const later: Coins = { state: 'later' }
const spent: Coins = { state: 'spent', piles: [2, 1, 2, 1, 1, 1, 1, 1], assumed: false }

describe('roadRedirect', () => {
  it('lets her onto a roadmap once she has finished one and is answering none', () => {
    expect(roadRedirect(student({ draft: null, finished: 1 }))).toBeNull()
    expect(roadRedirect(student({ draft: null, finished: 4, persona: null }))).toBeNull()
  })

  it('sends a student whose coins are stored but who has not finished to the end', () => {
    expect(roadRedirect(student({ coins: spent }))).toBe('/onboarding/done')
    expect(roadRedirect(student({ coins: later }))).toBe('/onboarding/done')
  })

  it('sends a student answering a roadmap back to where she left off, even with others finished', () => {
    expect(roadRedirect(student({}))).toBe('/onboarding/attention')
    expect(roadRedirect(student({ finished: 2 }))).toBe('/onboarding/attention')
    expect(roadRedirect(student({ lastStep: 'living', seenFutures: false }))).toBe(
      '/onboarding/living',
    )
    expect(roadRedirect(student({ persona: null, coins: spent }))).toBe('/onboarding/welcome')
  })

  it('sends a new student with nothing finished to the welcome', () => {
    expect(roadRedirect(student({ persona: null, draft: null }))).toBe('/onboarding/welcome')
  })
})
