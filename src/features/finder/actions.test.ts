// The finder's actions (criteria 9, 10, 11 and 27, and the refusals): who they refuse, the switch,
// her text's bounds, the hourly limit, the time limit on the whole search with its one retry, the
// one log line per search, and a failed search that says so without logging her words.
// The session and the repository are mocked; search and why are spies over the real modules, so
// the rest of the run still gets them (bun's module mocks last for the process). The time limit is
// tested on fake timers: a slow search moves the clock itself.

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
  mock,
  spyOn,
} from 'bun:test'
import type { Roadmap } from '@/shared/types/student'
import type { FinderResult, FinderWhy } from './model/types'

process.env.AI_PROVIDER = 'fake'

mock.module('server-only', () => ({}))

/** The roadmap the repository gives: null when it is not hers. */
let found: Roadmap | null = null
const getRoadmap = mock(async (_userId: string, _id: string) => found)
const roadmaps = { ...(await import('@/features/roadmaps/server/roadmaps')) }
mock.module('@/features/roadmaps/server/roadmaps', () => ({ ...roadmaps, getRoadmap }))

type FakeSession = { user: { id: string; role: string | null } } | null
let session: FakeSession = null
mock.module('@/shared/lib/auth/session', () => ({ getSession: async () => session }))

const realSearch = { ...(await import('./server/search')) }
const searchCourses = mock(realSearch.searchCourses)
mock.module('./server/search', () => ({ ...realSearch, searchCourses }))

const realWhy = { ...(await import('./server/why')) }
const writeFinderWhy = mock(realWhy.writeFinderWhy)
mock.module('./server/why', () => ({ ...realWhy, writeFinderWhy }))

const { compareCourseAction, findCoursesAction, finderWhyAction } = await import('./actions')
const { FINDER_PER_HOUR, SEARCH_RETRY_MS, SEARCH_TIMEOUT_MS } = await import('./model/config')
const { WHY_PER_HOUR } = await import('@/features/roads/server/why-limit')
const { FINDER_COURSES, FINDER_EXTRAS } = await import('./data/catalogue')
const { finderWhyTemplate } = await import('./model/why')
const { alternativeForCourse, compareRows } = await import('./model/compare')
const { roadFor } = await import('@/features/roads/model/road-for')
const { stated } = await import('@/features/roads/model/demo-profiles')

const TEXT = 'I like taking things apart'
const RESULT: FinderResult = {
  kind: 'nothing-close',
  best: 0.2,
  query: TEXT,
  model: 'fake',
  cached: false,
  searchMs: 3,
  keyword: [],
}
const FOUND: FinderResult = { ...RESULT, kind: 'results', hits: [], cached: true }
const COURSE = FINDER_EXTRAS[0]
const WHY: FinderWhy = {
  courseId: COURSE.courseId,
  text: 'Because.',
  quote: null,
  source: 'model',
  ms: 1,
}

const roadmap = (over: Partial<Roadmap> = {}): Roadmap => ({
  id: 'rm-1',
  name: null,
  answers: { level: { value: "Master's", state: 'stated' } },
  relative: null,
  coins: { state: 'later' },
  choices: {},
  ownWords: {},
  tags: [],
  lastStep: 'attention',
  copiedFrom: null,
  createdAt: new Date('2026-10-14T09:00:00Z'),
  finishedAt: new Date('2026-10-14T09:10:00Z'),
  lastOpenedAt: null,
  archivedAt: null,
  ...over,
})

/** Every line the action logged, each call's arguments joined. */
let info: ReturnType<typeof spyOn>
let error: ReturnType<typeof spyOn>
const lines = () =>
  [...info.mock.calls, ...error.mock.calls].map((args) =>
    args
      .map((arg: unknown) =>
        arg instanceof Error ? `${arg.message} ${String(arg.cause)}` : String(arg),
      )
      .join(' '),
  )
const searchLines = () => lines().filter((line) => line.startsWith('[finder.search]'))

beforeEach(() => {
  process.env.FINDER_ON = '1'
  process.env.COMPARE_ON = '1'
  delete process.env.STUDENT_AI_OFF
  found = roadmap()
  session = { user: { id: 'student-1', role: 'user' } }
  getRoadmap.mockClear()
  getRoadmap.mockImplementation(async () => found)
  searchCourses.mockClear()
  searchCourses.mockImplementation(async () => RESULT)
  writeFinderWhy.mockClear()
  writeFinderWhy.mockImplementation(async () => WHY)
  info = spyOn(console, 'info').mockImplementation(() => {})
  error = spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  info.mockRestore()
  error.mockRestore()
  jest.useRealTimers()
})
afterAll(() => {
  searchCourses.mockImplementation(realSearch.searchCourses)
  writeFinderWhy.mockImplementation(realWhy.writeFinderWhy)
  delete process.env.FINDER_ON
  delete process.env.COMPARE_ON
})

describe('findCoursesAction', () => {
  it('searches her trimmed words against her own roadmap, as hers', async () => {
    expect(await findCoursesAction('rm-1', `  ${TEXT}  `)).toEqual({ ok: true, result: RESULT })
    expect(getRoadmap).toHaveBeenCalledWith('student-1', 'rm-1')
    expect(searchCourses.mock.calls[0]?.slice(0, 3)).toEqual(['student-1', TEXT, roadmap().answers])
  })

  it('refuses a visitor who is not signed in, and one who is not a student', async () => {
    session = null
    expect(await findCoursesAction('rm-1', TEXT)).toMatchObject({ ok: false })
    session = { user: { id: 'admin-1', role: 'admin' } }
    expect(await findCoursesAction('rm-1', TEXT)).toMatchObject({ ok: false })
    expect(getRoadmap).not.toHaveBeenCalled()
    expect(searchCourses).not.toHaveBeenCalled()
  })

  it("refuses another student's roadmap and a malformed id", async () => {
    found = null
    expect(await findCoursesAction('rm-1', TEXT)).toEqual({ ok: false, error: 'Not found' })
    expect(await findCoursesAction('x'.repeat(65), TEXT)).toEqual({
      ok: false,
      error: 'Not found',
    })
    expect(searchCourses).not.toHaveBeenCalled()
  })

  it('is not found with the switch off, or with the student AI off', async () => {
    delete process.env.FINDER_ON
    expect(await findCoursesAction('rm-1', TEXT)).toEqual({ ok: false, error: 'Not found' })
    process.env.FINDER_ON = '1'
    process.env.STUDENT_AI_OFF = '1'
    expect(await findCoursesAction('rm-1', TEXT)).toEqual({ ok: false, error: 'Not found' })
    expect(searchCourses).not.toHaveBeenCalled()
  })

  it('asks for more when her words are empty or over 300 characters', async () => {
    for (const text of ['', '   ', 'x'.repeat(301)]) {
      expect(await findCoursesAction('rm-1', text)).toEqual({
        ok: false,
        error: 'Tell us a bit more',
      })
    }
    expect(searchCourses).not.toHaveBeenCalled()
    expect(await findCoursesAction('rm-1', 'x'.repeat(300))).toMatchObject({ ok: true })
  })

  it('says when she can search again once past her hourly limit; others still search (criterion 10)', async () => {
    session = { user: { id: 'student-busy', role: 'user' } }
    for (let i = 0; i < FINDER_PER_HOUR; i++) {
      expect(await findCoursesAction('rm-1', TEXT)).toMatchObject({ ok: true })
    }
    searchCourses.mockClear()
    const over = await findCoursesAction('rm-1', TEXT)
    expect(over.ok).toBe(false)
    const said = over.ok ? '' : over.error
    expect(said.startsWith('You have searched a lot this hour')).toBe(true)
    expect(said).toContain('60 minutes')
    expect(searchCourses).not.toHaveBeenCalled()

    session = { user: { id: 'student-calm', role: 'user' } }
    expect(await findCoursesAction('rm-1', TEXT)).toMatchObject({ ok: true })
  })

  it('logs one line per search, its outcome, time and cache, and never her words (criterion 11)', async () => {
    searchCourses.mockImplementation(async () => FOUND)
    await findCoursesAction('rm-1', TEXT)
    searchCourses.mockImplementation(async () => RESULT)
    await findCoursesAction('rm-1', TEXT)
    session = { user: { id: 'student-logged', role: 'user' } }
    for (let i = 0; i <= FINDER_PER_HOUR; i++) await findCoursesAction('rm-1', TEXT)

    const logged = searchLines()
    expect(logged.length).toBe(FINDER_PER_HOUR + 3)
    expect(logged[0]).toMatch(/^\[finder\.search\] results ms=\d+ cached=true$/)
    expect(logged[1]).toMatch(/^\[finder\.search\] nothing-close ms=\d+ cached=false$/)
    expect(logged.at(-1)).toMatch(/^\[finder\.search\] limit ms=\d+ cached=false$/)
    expect(lines().filter((line) => line.includes(TEXT))).toEqual([])
  })

  it('says it could not search, and logs no word of hers, when the search fails (criteria 9, 11)', async () => {
    searchCourses.mockImplementation(async () => {
      throw new Error(`timed out embedding "${TEXT}"`, { cause: new Error(TEXT) })
    })
    expect(await findCoursesAction('rm-1', TEXT)).toEqual({
      ok: false,
      error: "Couldn't search right now",
    })
    expect(searchCourses).toHaveBeenCalledTimes(1)
    expect(searchLines().length).toBe(1)
    expect(searchLines()[0]).toMatch(/^\[finder\.search\] failed ms=\d+ cached=false/)
    expect(lines().filter((line) => line.includes(TEXT))).toEqual([])
  })

  it('says it could not search when looking up her roadmap fails (criterion 9)', async () => {
    getRoadmap.mockImplementation(async () => {
      throw new Error('the database is down')
    })
    expect(await findCoursesAction('rm-1', TEXT)).toEqual({
      ok: false,
      error: "Couldn't search right now",
    })
    expect(searchCourses).not.toHaveBeenCalled()
  })

  it('tries once more, quietly, with 5 seconds when the first try passes 2 (cold start)', async () => {
    jest.useFakeTimers()
    searchCourses.mockImplementationOnce(async () => {
      jest.advanceTimersByTime(SEARCH_TIMEOUT_MS)
      await Promise.resolve()
      return RESULT
    })
    searchCourses.mockImplementationOnce(async () => {
      jest.advanceTimersByTime(SEARCH_RETRY_MS - 1)
      return FOUND
    })
    expect(await findCoursesAction('rm-1', TEXT)).toEqual({ ok: true, result: FOUND })
    expect(searchCourses).toHaveBeenCalledTimes(2)
    // The first try's embedding call is cancelled when its time runs out.
    expect(searchCourses.mock.calls[0]?.[3]?.aborted).toBe(true)
    expect(searchLines()).toEqual([expect.stringMatching(/ results ms=\d+ cached=true$/)])
  })

  it('says it could not search when the whole search, retry included, runs out of time (criterion 9)', async () => {
    jest.useFakeTimers()
    // Each try answers, but only once its time has run out.
    searchCourses.mockImplementation(async () => {
      jest.advanceTimersByTime(SEARCH_RETRY_MS)
      await Promise.resolve()
      return FOUND
    })
    expect(await findCoursesAction('rm-1', TEXT)).toEqual({
      ok: false,
      error: "Couldn't search right now",
    })
    expect(searchCourses).toHaveBeenCalledTimes(2)
    expect(searchLines().length).toBe(1)
    expect(searchLines()[0]).toMatch(/^\[finder\.search\] failed ms=\d+ cached=false/)
  })
})

describe('finderWhyAction', () => {
  it('gives the why for her trimmed words on her own roadmap', async () => {
    expect(await finderWhyAction('rm-1', COURSE.courseId, `  ${TEXT} `)).toEqual({
      ok: true,
      why: WHY,
    })
    expect(writeFinderWhy).toHaveBeenCalledWith(TEXT, COURSE.courseId)
  })

  it('refuses a non-student, a roadmap not hers, an unknown course, the switch off and bad words', async () => {
    session = { user: { id: 'admin-1', role: 'admin' } }
    expect(await finderWhyAction('rm-1', COURSE.courseId, TEXT)).toMatchObject({ ok: false })
    session = { user: { id: 'student-1', role: 'user' } }
    found = null
    expect(await finderWhyAction('rm-1', COURSE.courseId, TEXT)).toEqual({
      ok: false,
      error: 'Not found',
    })
    found = roadmap()
    expect(await finderWhyAction('rm-1', 'no-such-course', TEXT)).toEqual({
      ok: false,
      error: 'Not found',
    })
    delete process.env.FINDER_ON
    expect(await finderWhyAction('rm-1', COURSE.courseId, TEXT)).toEqual({
      ok: false,
      error: 'Not found',
    })
    process.env.FINDER_ON = '1'
    expect(await finderWhyAction('rm-1', COURSE.courseId, 'x'.repeat(301))).toEqual({
      ok: false,
      error: 'Tell us a bit more',
    })
    expect(writeFinderWhy).not.toHaveBeenCalled()
  })

  it('gives a why for the longest real catalogue course id, and refuses one past 80 characters', async () => {
    const longest = [...FINDER_COURSES].sort((a, b) => b.id.length - a.id.length)[0]
    expect(longest.id.length).toBeGreaterThan(64)
    expect(await finderWhyAction('rm-1', longest.id, TEXT)).toMatchObject({ ok: true })
    writeFinderWhy.mockClear()
    expect(await finderWhyAction('rm-1', 'x'.repeat(81), TEXT)).toEqual({
      ok: false,
      error: 'Not found',
    })
    expect(writeFinderWhy).not.toHaveBeenCalled()
  })

  it('gives the template without the model once she is past the why limit', async () => {
    session = { user: { id: 'student-why-busy', role: 'user' } }
    for (let i = 0; i < WHY_PER_HOUR; i++) {
      await finderWhyAction('rm-1', COURSE.courseId, TEXT)
    }
    writeFinderWhy.mockClear()
    const res = await finderWhyAction('rm-1', COURSE.courseId, TEXT)
    expect(res).toMatchObject({
      ok: true,
      why: {
        courseId: COURSE.courseId,
        text: finderWhyTemplate(TEXT, COURSE.description),
        quote: null,
        source: 'template',
      },
    })
    expect(writeFinderWhy).not.toHaveBeenCalled()
  })
})

describe('compareCourseAction (criterion 27)', () => {
  // Finder courses resolve only once the server module has registered them; loaded under a key of
  // its own (Bun caches a module by its specifier, query included), so it registers here whichever
  // test file loaded it first.
  const key = 'actions=1'
  beforeAll(() => import(`./server/road-courses?${key}`))

  const answers = stated({ stay: 'Yes', field: 'Cyber security', level: "Master's" })
  const twoYear = FINDER_COURSES.find((c) => c.years === 2)?.id ?? ''
  const oneYear = FINDER_COURSES.find((c) => c.years === 1)?.id ?? ''

  it('compares her road with a found course, which she can pin when it runs two years', async () => {
    found = roadmap({ answers })
    const spec = roadFor({ answers, relative: null }, process.env).spec
    if (!spec) throw new Error('her answers draw no road')
    const alt = alternativeForCourse(spec, twoYear)
    if (!alt) throw new Error(`no road around ${twoYear}`)

    expect(await compareCourseAction('rm-1', twoYear)).toEqual({
      ok: true,
      rows: compareRows(spec, alt, answers, alt.cityId),
      pinnable: true,
    })
    expect(getRoadmap).toHaveBeenCalledWith('student-1', 'rm-1')
  })

  it('compares a one-year course too, but it cannot be pinned yet', async () => {
    found = roadmap({ answers })
    const res = await compareCourseAction('rm-1', oneYear)
    expect(res.ok).toBe(true)
    expect(res.ok && res.pinnable).toBe(false)
  })

  it('compares the longest real catalogue course id, and refuses one past 80 characters', async () => {
    found = roadmap({ answers })
    const longest = [...FINDER_COURSES].sort((a, b) => b.id.length - a.id.length)[0]
    expect(longest.id.length).toBe(79)
    expect(await compareCourseAction('rm-1', longest.id)).toMatchObject({ ok: true })
    expect(await compareCourseAction('rm-1', 'x'.repeat(81))).toEqual({
      ok: false,
      error: 'Not found',
    })
  })

  it('refuses a visitor who is not signed in, and one who is not a student', async () => {
    session = null
    expect(await compareCourseAction('rm-1', twoYear)).toMatchObject({ ok: false })
    session = { user: { id: 'admin-1', role: 'admin' } }
    expect(await compareCourseAction('rm-1', twoYear)).toMatchObject({ ok: false })
    expect(getRoadmap).not.toHaveBeenCalled()
  })

  it("is not found for another student's roadmap, an unknown course or a malformed id", async () => {
    found = null
    expect(await compareCourseAction('rm-1', twoYear)).toEqual({ ok: false, error: 'Not found' })
    found = roadmap({ answers })
    expect(await compareCourseAction('rm-1', 'no-such-course')).toEqual({
      ok: false,
      error: 'Not found',
    })
    expect(await compareCourseAction('x'.repeat(65), twoYear)).toEqual({
      ok: false,
      error: 'Not found',
    })
  })

  it('is not found with the compare switch off', async () => {
    found = roadmap({ answers })
    delete process.env.COMPARE_ON
    expect(await compareCourseAction('rm-1', twoYear)).toEqual({ ok: false, error: 'Not found' })
    expect(getRoadmap).not.toHaveBeenCalled()
  })
})
