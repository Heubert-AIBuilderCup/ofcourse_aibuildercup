// Her own words and tags on the roadmap she is answering, against the development database
// (Docker, port 5433); off by default so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/roadmaps/server/own-words.db.test.ts
// Every account here is the test's own (its id starts `ow-t-`, its email ends @ow.e2e.test) and
// is deleted after, with its roadmaps. No query here breaks a constraint.

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import type { RoadmapTag } from '@/shared/types/student'

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const P = 'ow-t-'

const tag = (text: string, over: Partial<RoadmapTag> = {}): RoadmapTag => ({
  text,
  quote: text.toLowerCase(),
  step: 'living',
  wellbeing: false,
  ...over,
})

describe.skipIf(!enabled)('her own words and tags against the database', () => {
  let server: typeof import('./roadmaps')
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db/schema')
  let orm: typeof import('drizzle-orm')

  async function cleanUp() {
    await db.delete(schema.user).where(orm.like(schema.user.id, `${P}%`))
  }

  const rowOf = async (id: string) => {
    const [row] = await db.select().from(schema.roadmap).where(orm.eq(schema.roadmap.id, id))
    return row
  }

  /** A finished roadmap for this student, with words and tags already on it. */
  async function finished(uid: string) {
    const draft = await server.ensureDraft(uid)
    await db
      .update(schema.roadmap)
      .set({ ownWords: { study: 'kept as it was' }, tags: [tag('Kept')] })
      .where(orm.eq(schema.roadmap.id, draft.id))
    const r = await server.finishRoadmap(uid)
    if (!r) throw new Error('nothing to finish')
    return r
  }

  beforeAll(async () => {
    server = await import('./roadmaps')
    ;({ db } = await import('@/shared/lib/db'))
    schema = await import('@/shared/lib/db/schema')
    orm = await import('drizzle-orm')
    await cleanUp()
    const base = (k: string) => ({ id: `${P}${k}`, name: `OW ${k}`, email: `${P}${k}@ow.e2e.test` })
    await db.insert(schema.user).values([base('a'), base('b'), base('c'), base('d'), base('e')])
  })

  afterAll(async () => {
    await cleanUp()
  })

  test("saveOwnWords writes one step's words on her draft and keeps the other steps'", async () => {
    const uid = `${P}a`
    const draft = await server.ensureDraft(uid)
    expect((await rowOf(draft.id))?.ownWords).toBeNull()
    const first = await server.saveOwnWords(uid, 'study', 'data science, a masters')
    expect(first?.id).toBe(draft.id)
    expect(first?.ownWords).toEqual({ study: 'data science, a masters' })
    await server.saveOwnWords(uid, 'facts', '26 lakh from my family')
    const again = await server.saveOwnWords(uid, 'study', 'cyber security')
    expect(again?.ownWords).toEqual({ study: 'cyber security', facts: '26 lakh from my family' })
    expect((await rowOf(draft.id))?.ownWords).toEqual({
      study: 'cyber security',
      facts: '26 lakh from my family',
    })
  })

  test("saveOwnWords touches no finished roadmap and no other student's draft", async () => {
    const uid = `${P}b`
    const done = await finished(uid)
    expect(await server.saveOwnWords(uid, 'study', 'new words')).toBeNull()
    expect((await rowOf(done.id))?.ownWords).toEqual({ study: 'kept as it was' })
    expect(await server.getDraft(uid)).toBeNull()

    const other = await server.ensureDraft(`${P}c`)
    await server.saveOwnWords(`${P}a`, 'living', 'near my cousin')
    expect((await rowOf(other.id))?.ownWords).toBeNull()
  })

  test('addTags appends to her draft, dropping a text already there whatever its case', async () => {
    const uid = `${P}c`
    const draft = await server.ensureDraft(uid)
    await server.addTags(uid, [tag('Near her cousin'), tag('Feels lonely', { wellbeing: true })])
    await server.addTags(uid, [
      tag('near her COUSIN', { step: 'after' }),
      tag('Likes the beach'),
      tag('likes the beach'),
    ])
    expect((await server.getDraft(uid))?.tags).toEqual([
      tag('Near her cousin'),
      tag('Feels lonely', { wellbeing: true }),
      tag('Likes the beach'),
    ])
    expect((await rowOf(draft.id))?.tags).toHaveLength(3)
  })

  test('addTags keeps at most 30, the oldest dropped', async () => {
    const uid = `${P}d`
    await server.ensureDraft(uid)
    const many = Array.from({ length: 28 }, (_, i) => tag(`Tag ${i}`))
    await server.addTags(uid, many)
    await server.addTags(uid, [tag('Tag 28'), tag('Tag 29'), tag('Tag 30'), tag('Tag 31')])
    const tags = (await server.getDraft(uid))?.tags ?? []
    expect(tags).toHaveLength(30)
    expect(tags[0]?.text).toBe('Tag 2')
    expect(tags.at(-1)?.text).toBe('Tag 31')
  })

  test("addTags touches no finished roadmap and no other student's draft", async () => {
    const uid = `${P}e`
    const done = await finished(uid)
    await server.addTags(uid, [tag('Not added')])
    expect((await rowOf(done.id))?.tags).toEqual([tag('Kept')])
    expect(await server.getDraft(uid)).toBeNull()

    const before = (await server.getDraft(`${P}d`))?.tags
    await server.addTags(`${P}c`, [tag('Only hers')])
    expect((await server.getDraft(`${P}d`))?.tags).toEqual(before ?? [])
  })
})
