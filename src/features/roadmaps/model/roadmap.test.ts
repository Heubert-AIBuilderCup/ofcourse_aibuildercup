import { describe, expect, test } from 'bun:test'
import type { Roadmap } from '@/shared/types/student'
import { isNew, openedLabel, orderRoadmaps, roadmapName } from './roadmap'

const at = (day: number, hour = 12) => new Date(2026, 9, day, hour)

const make = (over: Partial<Roadmap>): Roadmap => ({
  id: 'r',
  name: null,
  answers: {},
  relative: null,
  coins: null,
  choices: {},
  lastStep: 'attention',
  copiedFrom: null,
  createdAt: at(1),
  finishedAt: at(1),
  lastOpenedAt: null,
  ...over,
})

// The names the list page reads from the mock road: the course where she is, and its city.
const names = { here: 'Cyber Security', city: 'Perth' }

describe('roadmapName', () => {
  test('is her own name when she gave one', () => {
    expect(roadmapName(make({ name: 'On a budget' }), names)).toBe('On a budget')
  })

  test('is named from its road when she gave none', () => {
    expect(roadmapName(make({ name: null }), names)).toBe('Cyber Security in Perth')
  })
})

describe('orderRoadmaps', () => {
  const list = [
    make({ id: 'old-unopened', name: 'Zeta', createdAt: at(2) }),
    make({ id: 'opened-earlier', name: 'beta', createdAt: at(5), lastOpenedAt: at(8) }),
    make({ id: 'new-unopened', name: null, createdAt: at(9) }),
    make({ id: 'opened-last', name: 'Alpha', createdAt: at(1), lastOpenedAt: at(10) }),
  ].map((r) => ({ ...r, name: roadmapName(r, names) }))

  const ids = (l: { id: string }[]) => l.map((r) => r.id)

  test('last opened first, a never opened one by when it was made: a new one above those opened before it', () => {
    expect(ids(orderRoadmaps(list, 'opened'))).toEqual([
      'opened-last',
      'new-unopened',
      'opened-earlier',
      'old-unopened',
    ])
  })

  test('a roadmap just made comes first, above the one she opened', () => {
    const opened = { id: 'opened', name: 'A', createdAt: at(1), lastOpenedAt: at(13) }
    const made = { id: 'made', name: 'B', createdAt: at(14), lastOpenedAt: null }
    expect(ids(orderRoadmaps([opened, made], 'opened'))).toEqual(['made', 'opened'])
  })

  test('by date made, newest first', () => {
    expect(ids(orderRoadmaps(list, 'made'))).toEqual([
      'new-unopened',
      'opened-earlier',
      'old-unopened',
      'opened-last',
    ])
  })

  test('by name A to Z, whatever the case, a road-named one among them', () => {
    expect(ids(orderRoadmaps(list, 'name'))).toEqual([
      'opened-last',
      'opened-earlier',
      'new-unopened',
      'old-unopened',
    ])
  })

  test('leaves the list it was given as it was', () => {
    const before = ids(list)
    orderRoadmaps(list, 'name')
    expect(ids(list)).toEqual(before)
  })
})

test('a roadmap is new until it is opened', () => {
  expect(isNew(make({ lastOpenedAt: null }))).toBe(true)
  expect(isNew(make({ lastOpenedAt: at(3) }))).toBe(false)
})

describe('openedLabel', () => {
  const now = at(14, 9)

  test('counts calendar days to when she last opened it', () => {
    expect(openedLabel(at(14, 1), at(1), now)).toBe('Opened today')
    expect(openedLabel(at(13, 23), at(1), now)).toBe('Opened yesterday')
    expect(openedLabel(at(11, 10), at(1), now)).toBe('Opened 3 days ago')
  })

  test('never opened, it says when it was made', () => {
    expect(openedLabel(null, at(14, 8), now)).toBe('Made just now')
    expect(openedLabel(null, at(13), now)).toBe('Made yesterday')
    expect(openedLabel(null, at(10), now)).toBe('Made 4 days ago')
  })
})
