// The finder's search against a Postgres with pgvector; off by default so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/finder/server/search.db.test.ts
// Every row here is the test's own (its id starts `sd-t-`), embedded by the fake, and is deleted
// before and after. Other rows in the table (a seeded catalogue embedded by the real model) score
// as noise against a fake query vector, so the assertions read this test's own rows.

import { afterAll, beforeAll, describe, expect, type Mock, mock, test } from 'bun:test'

mock.module('server-only', () => ({}))
process.env.AI_PROVIDER = 'fake'

const enabled = process.env.DB_TESTS === '1'
const P = 'sd-t-'
const ME = 'student-sd-t'
/**
 * The both-row's two words, each twice: past the three-word floor (FINDER_MIN_WORDS), in the
 * same direction as that row's fake vector. The keyword query below repeats its word for the same
 * reason.
 */
const BOTH = 'cryptography networks, cryptography networks'

type Row = { k: string; name: string; description: string; level?: string; niche?: string }

const ROWS: Row[] = [
  { k: 'both', name: 'Cryptography Networks', description: 'Cryptography and networks.' },
  { k: 'crypto', name: 'Applied Cryptography', description: 'Cryptography for secure messages.' },
  { k: 'nets', name: 'Networks', description: 'Networks, routers and switches.' },
  {
    k: 'diploma',
    name: 'Diploma of Cryptography Networks',
    description: 'Cryptography networks basics.',
    level: 'Diploma',
  },
  {
    k: 'forensics',
    name: 'Marine Biology',
    description: 'Oceans and fish.',
    niche: 'digital-forensics',
  },
  { k: 'pottery', name: 'Pottery', description: 'Clay and kilns.' },
]

describe.skipIf(!enabled)('searchCourses against the database', () => {
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db/schema')
  let orm: typeof import('drizzle-orm')
  let searchCourses: typeof import('./search').searchCourses
  let realDetail: typeof import('./detail')
  let courseDetail: Mock<typeof import('./detail').courseDetail>

  const own = <T extends { courseId: string }>(hits: T[]) =>
    hits.filter((h) => h.courseId.startsWith(P)).map((h) => h.courseId.slice(P.length))

  async function cleanUp() {
    await db.delete(schema.courseDoc).where(orm.like(schema.courseDoc.id, `${P}%`))
  }

  beforeAll(async () => {
    ;({ db } = await import('@/shared/lib/db'))
    schema = await import('@/shared/lib/db/schema')
    orm = await import('drizzle-orm')
    // A spy over the real course detail, so a case can read what the search asked it for.
    realDetail = { ...(await import('./detail')) }
    courseDetail = mock(realDetail.courseDetail)
    mock.module('./detail', () => ({ ...realDetail, courseDetail }))
    ;({ searchCourses } = await import('./search'))
    const { embedTexts } = await import('./embed')
    await cleanUp()
    const vectors = await embedTexts(
      ROWS.map((r) => `${r.name}. ${r.description}`),
      'RETRIEVAL_DOCUMENT',
    )
    await db.insert(schema.courseDoc).values(
      ROWS.map((r, i) => ({
        id: `${P}${r.k}`,
        name: r.name,
        university: 'Test University',
        cityId: 'sydney',
        level: r.level ?? "Master's",
        field: 'cyber',
        graphField: r.niche ?? 'cyber',
        description: r.description,
        textHash: `hash-${r.k}`,
        embeddingModel: 'fake',
        years: 2,
        feeK: 40,
        niche: r.niche !== undefined,
        embedding: vectors[i],
      })),
    )
  })

  afterAll(async () => {
    await cleanUp()
  })

  /** A search with the course detail switch set to `value` (unset if undefined), then restored. */
  async function searchWithDetail(value: string | undefined) {
    const before = process.env.COURSE_DETAIL_ON
    if (value === undefined) delete process.env.COURSE_DETAIL_ON
    else process.env.COURSE_DETAIL_ON = value
    courseDetail.mockClear()
    try {
      const result = await searchCourses(ME, BOTH, {})
      if (result.kind !== 'results') throw new Error(`Expected results, got ${result.kind}`)
      return result
    } finally {
      if (before === undefined) delete process.env.COURSE_DETAIL_ON
      else process.env.COURSE_DETAIL_ON = before
    }
  }

  test('with the course detail on, a hit carries its detail, asked for in its own city', async () => {
    // The test's rows are not in the finder's catalogue: each stands for a Perth business diploma.
    courseDetail.mockImplementation((id, cityId) =>
      realDetail.courseDetail(id.startsWith(P) ? 'f-diploma-of-business-tafe-perth' : id, cityId),
    )
    try {
      const result = await searchWithDetail('1')
      expect(result.hits[0]?.courseId).toBe(`${P}both`)
      expect((result.hits[0]?.detail?.jobGroups[0]?.jobs.length ?? 0) > 0).toBe(true)
      expect(
        courseDetail.mock.calls.some(([id, city]) => `${id} ${city}` === `${P}both sydney`),
      ).toBe(true)
    } finally {
      courseDetail.mockImplementation(realDetail.courseDetail)
    }
  })

  test('with the course detail unset, no hit has a detail key and none is worked out', async () => {
    const result = await searchWithDetail(undefined)
    expect('detail' in (result.hits[0] ?? {})).toBe(false)
    expect(result.hits.some((h) => 'detail' in h)).toBe(false)
    expect(courseDetail).not.toHaveBeenCalled()
  })

  test('the row with both words comes first, and scores descend', async () => {
    const result = await searchCourses(ME, BOTH, {})
    if (result.kind !== 'results') throw new Error(`Expected results, got ${result.kind}`)
    expect(result.hits[0]?.courseId).toBe(`${P}both`)
    expect(result.hits[0]?.score).toBe(1)
    expect(result.hits[0]?.definition).toBeNull()
    const scores = result.hits.map((h) => h.score)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
    expect(own(result.hits).slice(0, 4)).toEqual(['both', 'diploma', 'nets', 'crypto'])
    expect(result.query).toBe(BOTH)
  })

  test('a Diploma is a hit that fails level for a stated Bachelor’s', async () => {
    const result = await searchCourses(ME, BOTH, {
      qual: { value: "Bachelor's", state: 'stated' },
    })
    if (result.kind !== 'results') throw new Error(`Expected results, got ${result.kind}`)
    const failed = Object.fromEntries(result.hits.map((h) => [h.courseId, h.failed]))
    expect(failed[`${P}diploma`]).toEqual(['level'])
    expect(failed[`${P}both`]).toEqual([])
  })

  test('the keyword search lists the rows whose text has the word, ranked above 0', async () => {
    const result = await searchCourses(ME, 'cryptography cryptography cryptography', {})
    expect(own(result.keyword).sort()).toEqual(['both', 'crypto', 'diploma'])
    for (const hit of result.keyword) expect(hit.rank).toBeGreaterThan(0)
  })

  test('a niche hit carries its field’s definition', async () => {
    const { FIELDS } = await import('@/features/roads/data/fields')
    const result = await searchCourses(ME, 'marine biology oceans', {})
    if (result.kind !== 'results') throw new Error(`Expected results, got ${result.kind}`)
    const byId = Object.fromEntries(result.hits.map((h) => [h.courseId, h]))
    expect(byId[`${P}forensics`]?.definition).toBe(
      FIELDS.find((f) => f.id === 'digital-forensics')?.definition ?? 'missing',
    )
  })

  test('text that shares no word with any course is nothing close', async () => {
    const result = await searchCourses(ME, 'zebra giraffe okapi', {})
    expect(result.kind).toBe('nothing-close')
    expect(own(result.keyword)).toEqual([])
  })

  test('a second identical search is answered from the cache', async () => {
    const first = await searchCourses(ME, 'routers, switches and networks', {})
    const second = await searchCourses(ME, 'routers, switches and networks', {})
    expect(first.cached).toBe(false)
    expect(second.cached).toBe(true)
  })
})
