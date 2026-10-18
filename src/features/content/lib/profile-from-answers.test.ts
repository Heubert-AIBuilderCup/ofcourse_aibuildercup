import { describe, expect, it } from 'bun:test'
import type { StoredAnswers } from '@/shared/types/student'
import { feedRoadmapOf, profileFromAnswers, profileFromRoadmaps } from './profile-from-answers'

const stated = (value: string) => ({ value, state: 'stated' as const })

describe('profileFromAnswers', () => {
  it('maps the two countries with a market to their ids', () => {
    expect(profileFromAnswers({ where: stated('Nepal') }).homeMarket).toBe('NP')
    expect(profileFromAnswers({ where: stated('India') }).homeMarket).toBe('IN')
  })

  it('has no home market for any other country or none', () => {
    expect(profileFromAnswers({ where: stated('Bangladesh') }).homeMarket).toBeNull()
    expect(profileFromAnswers({}).homeMarket).toBeNull()
  })

  it('has Australia as the destination when she chose it, none when open to others or unanswered', () => {
    expect(profileFromAnswers({ dest: stated('Australia') }).destinations).toEqual(['AU'])
    expect(profileFromAnswers({ dest: stated('Open to others') }).destinations).toEqual([])
    expect(profileFromAnswers({}).destinations).toEqual([])
  })

  it('reads a "Not sure" (an assumed default) as no answer: no home market, no destination', () => {
    const assumed = (value: string) => ({ value, state: 'assumed' as const })
    const profile = profileFromAnswers({ where: assumed('Nepal'), dest: assumed('Australia') })
    expect(profile.homeMarket).toBeNull()
    expect(profile.destinations).toEqual([])
  })

  it('never has an age band', () => {
    const answers: StoredAnswers = { where: stated('Nepal'), dest: stated('Australia') }
    expect(profileFromAnswers(answers).ageBand).toBeNull()
  })
})

type Made = Parameters<typeof feedRoadmapOf>[0]
const roadmap = (over: Partial<Made> = {}): Made => ({
  name: null,
  answers: {},
  choices: {},
  ...over,
})

describe('feedRoadmapOf (a roadmap as the feed links posts to it)', () => {
  it('is in Australia when she chose it, or when it is pinned to a course in a catalogue city', () => {
    expect(feedRoadmapOf(roadmap({ answers: { dest: stated('Australia') } })).destinations).toEqual(
      ['AU'],
    )
    const pinned = roadmap({ choices: { pinned: { courseId: 'c1', cityId: 'sydney' } } })
    expect(feedRoadmapOf(pinned).destinations).toEqual(['AU'])
    expect(
      feedRoadmapOf(roadmap({ answers: { dest: stated('Open to others') } })).destinations,
    ).toEqual([])
  })

  it('is named by her own name, else by its city and the field she stated, else "Your roadmap"', () => {
    const answers: StoredAnswers = { field: stated('Data science') }
    const choices = { pinned: { courseId: 'c1', cityId: 'sydney' } }
    expect(feedRoadmapOf(roadmap({ name: 'Plan A', answers, choices })).name).toBe('Plan A')
    expect(feedRoadmapOf(roadmap({ answers, choices })).name).toBe('Sydney · Data science')
    expect(feedRoadmapOf(roadmap({ answers })).name).toBe('Data science')
    expect(feedRoadmapOf(roadmap()).name).toBe('Your roadmap')
  })
})

describe('profileFromRoadmaps (the chips her roadmaps preset)', () => {
  it('takes the home country from the first (opened last) and every destination across them all', () => {
    const profile = profileFromRoadmaps([
      roadmap({ answers: { where: stated('India'), dest: stated('Open to others') } }),
      roadmap({ answers: { where: stated('Nepal'), dest: stated('Australia') } }),
      roadmap({ choices: { pinned: { courseId: 'c1', cityId: 'perth' } } }),
    ])
    expect(profile).toEqual({ homeMarket: 'IN', destinations: ['AU'], ageBand: null })
  })

  it('is null with no roadmap', () => {
    expect(profileFromRoadmaps([])).toBeNull()
  })
})
