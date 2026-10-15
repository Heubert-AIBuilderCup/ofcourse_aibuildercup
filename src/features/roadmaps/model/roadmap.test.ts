import { describe, expect, test } from 'bun:test'
import { newRoadmapPath } from '@/shared/lib/student-paths'
import type { Roadmap, StoredAnswers } from '@/shared/types/student'
import {
  answerDiffs,
  firstMade,
  fromLine,
  isNew,
  lastOpenedOut,
  openedLabel,
  orderRoadmaps,
  roadmapName,
  roadNames,
} from './roadmap'

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
  archivedAt: null,
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

  test('is "New roadmap" from scratch, with nowhere on its road yet', () => {
    expect(roadmapName(make({ name: null }), { here: '', city: '' })).toBe('New roadmap')
  })
})

describe('fromLine', () => {
  test('her first roadmap is from onboarding; one made after it with no source, from scratch', () => {
    expect(fromLine(make({}), { first: true })).toBe('From onboarding')
    expect(fromLine(make({}), { first: false })).toBe('From scratch')
  })

  test('a copy names its source, or says it was deleted', () => {
    const copy = make({ copiedFrom: 'src' })
    expect(fromLine(copy, { first: false, source: 'Cyber Security in Perth' })).toBe(
      'Copy of Cyber Security in Perth',
    )
    expect(fromLine(copy, { first: false })).toBe('Copy of a roadmap you deleted')
  })
})

describe('firstMade', () => {
  test('is the oldest of her roadmaps, whatever the order given; none for none', () => {
    const list = [make({ id: 'b', createdAt: at(5) }), make({ id: 'a', createdAt: at(1) })]
    expect(firstMade(list)?.id).toBe('a')
    expect(firstMade([])).toBeNull()
  })
})

describe('roadNames', () => {
  const tiles = [
    { id: 'perth', name: 'Perth' },
    { id: 'cyber', name: 'Cyber Security' },
  ]

  test('reads the course where she is and the first city on her road', () => {
    expect(roadNames({ tiles, walk: { here: 'cyber', cityLine: ['perth'] } })).toEqual(names)
  })

  test('leaves a name it cannot find empty', () => {
    expect(roadNames({ tiles, walk: { here: 'gone', cityLine: [] } })).toEqual({
      here: '',
      city: '',
    })
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

describe('lastOpenedOut', () => {
  test('is the one she opened last, an archived one never, however recently opened', () => {
    const list = [
      make({ id: 'archived', lastOpenedAt: at(12), archivedAt: at(12) }),
      make({ id: 'earlier', lastOpenedAt: at(8) }),
      make({ id: 'last', lastOpenedAt: at(10) }),
    ]
    expect(lastOpenedOut(list)?.id).toBe('last')
  })

  test('counts a never opened one by when it was made, so one just made comes first', () => {
    const list = [
      make({ id: 'opened', createdAt: at(1), lastOpenedAt: at(10) }),
      make({ id: 'made', createdAt: at(11), lastOpenedAt: null }),
    ]
    expect(lastOpenedOut(list)?.id).toBe('made')
  })

  test("reads the list's own flag as well as the stored time", () => {
    const list = [
      { id: 'a', createdAt: at(1), lastOpenedAt: at(10), archived: true },
      { id: 'b', createdAt: at(1), lastOpenedAt: at(9), archived: false },
    ]
    expect(lastOpenedOut(list)?.id).toBe('b')
  })

  test('is null when every one is archived, and when there is none', () => {
    expect(lastOpenedOut([make({ archivedAt: at(3), lastOpenedAt: at(3) })])).toBeNull()
    expect(lastOpenedOut([])).toBeNull()
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

describe('answerDiffs', () => {
  const source: StoredAnswers = {
    amount: { value: 36, state: 'stated' },
    eng: { value: 'IELTS 7.0', state: 'stated' },
    climate: { value: 'Warm', state: 'stated' },
  }

  test('one chip per answer that differs, "Question: label", in the questions’ order', () => {
    expect(
      answerDiffs(source, {
        // Out of order on purpose: the chips follow the questions.
        climate: { value: 'Mild', state: 'stated' },
        amount: { value: 30, state: 'stated' },
        eng: { value: 'IELTS 7.0', state: 'stated' },
        community: { value: 'Yes', state: 'stated' },
      }),
    ).toEqual([
      'Your budget per year · Amount: AUD 30k',
      'Does a community of similar culture, or relatives nearby, matter?: Yes',
      'Climate (optional): Mild',
    ])
  })

  test('a removed answer reads "cleared"; "Not sure" reads as itself', () => {
    expect(
      answerDiffs(source, {
        amount: { value: 30, state: 'assumed' },
        eng: { value: 'IELTS 7.0', state: 'stated' },
      }),
    ).toEqual(['Your budget per year · Amount: Not sure', 'Climate (optional): cleared'])
  })

  test('areas picked in another order are the same answer', () => {
    const areas = (value: string[]): StoredAnswers => ({ areas: { value, state: 'stated' } })
    expect(answerDiffs(areas(['Health', 'IT']), areas(['IT', 'Health']))).toEqual([])
  })

  test('the same answers, or no source, give none', () => {
    expect(answerDiffs(source, { ...source })).toEqual([])
    expect(answerDiffs(null, source)).toEqual([])
  })
})

test('a new roadmap’s draft: a copy of one, or from scratch', () => {
  expect(newRoadmapPath('abc')).toBe('/roadmaps/new?from=abc')
  expect(newRoadmapPath()).toBe('/roadmaps/new')
})
