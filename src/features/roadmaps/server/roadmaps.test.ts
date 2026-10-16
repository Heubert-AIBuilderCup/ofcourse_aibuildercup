// The roadmaps' repository against the development database (Docker, port 5433); off by default
// so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/roadmaps/server/roadmaps.test.ts
// Every account here is the test's own (its id starts `rm-t-`, its email ends @rm.e2e.test) and
// is deleted after, with its roadmaps.

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const P = 'rm-t-'

describe.skipIf(!enabled)('the roadmaps against the database', () => {
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

  /** A finished roadmap for this student, through the module's own path. */
  async function finished(uid: string) {
    await server.ensureDraft(uid)
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
    const base = (k: string) => ({ id: `${P}${k}`, name: `RM ${k}`, email: `${P}${k}@rm.e2e.test` })
    await db
      .insert(schema.user)
      .values([
        base('a'),
        base('b'),
        base('c'),
        base('d'),
        base('e'),
        base('f'),
        base('g'),
        base('h'),
        base('i'),
        base('j'),
        base('k'),
        base('l'),
        base('m'),
      ])
  })

  afterAll(async () => {
    await cleanUp()
  })

  test('the draft is made once, and a second unfinished roadmap is refused', async () => {
    const uid = `${P}a`
    expect(await server.getDraft(uid)).toBeNull()
    const draft = await server.ensureDraft(uid)
    expect(draft).toMatchObject({ finishedAt: null, name: null, answers: {}, lastStep: 'picture' })
    expect((await server.ensureDraft(uid)).id).toBe(draft.id)
    expect((await server.getDraft(uid))?.id).toBe(draft.id)
    await expect(db.insert(schema.roadmap).values({ userId: uid }).execute()).rejects.toMatchObject(
      {
        cause: { constraint_name: 'roadmap_one_unfinished' },
      },
    )
  })

  test('finishing sets the time once; a second press changes nothing', async () => {
    const uid = `${P}a`
    const draft = await server.ensureDraft(uid)
    const done = await server.finishRoadmap(uid)
    expect(done?.id).toBe(draft.id)
    expect(done?.finishedAt).toBeInstanceOf(Date)
    await Bun.sleep(20)
    expect(await server.finishRoadmap(uid)).toBeNull()
    expect((await rowOf(draft.id))?.finishedAt).toEqual(done?.finishedAt ?? null)
    expect(await server.getDraft(uid)).toBeNull()
    // Finished, a new draft may begin (Start from scratch).
    const next = await server.ensureDraft(uid)
    expect(next.id).not.toBe(draft.id)
  })

  test('the list holds only her own alive, finished roadmaps', async () => {
    const a = `${P}b`
    const b = `${P}c`
    const mine = await finished(a)
    await server.ensureDraft(a)
    for (let i = 0; i < 3; i++) await finished(b)
    const list = await server.listRoadmaps(a)
    expect(list.map((r) => r.id)).toEqual([mine.id])
    expect(list[0]).not.toHaveProperty('userId')
    expect(list[0]).not.toHaveProperty('deletedAt')
    expect(await server.listRoadmaps(b)).toHaveLength(3)
  })

  test('the list puts the last opened first, a never opened one by when it was made', async () => {
    const uid = `${P}d`
    const first = await finished(uid)
    const second = await finished(uid)
    await server.touchOpened(uid, first.id)
    // Made after she opened the first: a new roadmap comes first (criterion 9).
    const made = await finished(uid)
    const ids = (await server.listRoadmaps(uid)).map((r) => r.id)
    expect(ids).toEqual([made.id, first.id, second.id])
  })

  test("another student's roadmap is never read, renamed, opened, changed, copied or deleted", async () => {
    const owner = `${P}b`
    const other = `${P}c`
    const [theirs] = await server.listRoadmaps(owner)
    expect(await server.getRoadmap(other, theirs.id)).toBeNull()
    expect(await server.renameRoadmap(other, theirs.id, 'Mine now')).toBe(false)
    expect(await server.touchOpened(other, theirs.id)).toBe(false)
    expect(await server.saveChoices(other, theirs.id, { swapped: true })).toBe(false)
    expect(await server.createRoadmap(other, { fromId: theirs.id, answers: {} })).toBe('not-found')
    expect(await server.softDeleteRoadmap(other, theirs.id)).toBe('not-found')
    expect(await rowOf(theirs.id)).toMatchObject({
      name: null,
      lastOpenedAt: null,
      choices: {},
      deletedAt: null,
    })
  })

  test('a rename is trimmed, between 1 and 60 characters', async () => {
    const uid = `${P}e`
    const r = await finished(uid)
    expect(await server.renameRoadmap(uid, r.id, '  On a budget  ')).toBe(true)
    expect((await server.getRoadmap(uid, r.id))?.name).toBe('On a budget')
    expect(await server.renameRoadmap(uid, r.id, '   ')).toBe(false)
    expect(await server.renameRoadmap(uid, r.id, 'x'.repeat(61))).toBe(false)
    expect(await server.renameRoadmap(uid, r.id, 'x'.repeat(60))).toBe(true)
  })

  test('delete hides it, restore brings it back as it was', async () => {
    const uid = `${P}e`
    const [r] = await server.listRoadmaps(uid)
    const other = await finished(uid)
    expect(await server.softDeleteRoadmap(uid, r.id)).toBe(true)
    expect((await server.listRoadmaps(uid)).map((x) => x.id)).toEqual([other.id])
    expect(await server.getRoadmap(uid, r.id)).toBeNull()
    expect(await server.restoreRoadmap(uid, r.id)).toBe(true)
    expect(await server.getRoadmap(uid, r.id)).toEqual(r)
    expect(await server.restoreRoadmap(uid, r.id)).toBe(false)
  })

  test('her only roadmap is never deleted, even by two deletes sent at once', async () => {
    const uid = `${P}g`
    const a = await finished(uid)
    const b = await finished(uid)
    const deleted = await Promise.all([
      server.softDeleteRoadmap(uid, a.id),
      server.softDeleteRoadmap(uid, b.id),
    ])
    expect(deleted.toSorted()).toEqual(['kept-one', true])
    const left = await server.listRoadmaps(uid)
    expect(left).toHaveLength(1)
    expect(await server.softDeleteRoadmap(uid, left[0].id)).toBe('kept-one')
    expect(await server.listRoadmaps(uid)).toHaveLength(1)
  })

  test('opening tells whether it was the first time, and moves it to the top', async () => {
    const uid = `${P}f`
    const r = await finished(uid)
    expect(await server.touchOpened(uid, r.id)).toBe(true)
    const first = (await server.getRoadmap(uid, r.id))?.lastOpenedAt
    expect(first).toBeInstanceOf(Date)
    await Bun.sleep(20)
    expect(await server.touchOpened(uid, r.id)).toBe(false)
    const second = (await server.getRoadmap(uid, r.id))?.lastOpenedAt
    expect(second?.getTime()).toBeGreaterThan(first?.getTime() ?? 0)
  })

  test("the board's choices keep only what the schema knows", async () => {
    const uid = `${P}f`
    const [r] = await server.listRoadmaps(uid)
    const choices = { swapped: true, read: false, sneaky: 'x' } as { swapped: boolean }
    expect(await server.saveChoices(uid, r.id, choices)).toBe(true)
    expect((await rowOf(r.id))?.choices).toEqual({ swapped: true, read: false })
  })

  test('her own words and tags read back empty when null, and tags empty when malformed', async () => {
    const uid = `${P}m`
    const r = await finished(uid)
    await db
      .update(schema.roadmap)
      .set({ ownWords: null, tags: null })
      .where(orm.eq(schema.roadmap.id, r.id))
    const empty = await server.getRoadmap(uid, r.id)
    expect(empty?.ownWords).toEqual({})
    expect(empty?.tags).toEqual([])
    await db
      .update(schema.roadmap)
      .set({ tags: [{ text: 5 }] as never })
      .where(orm.eq(schema.roadmap.id, r.id))
    expect((await server.getRoadmap(uid, r.id))?.tags).toEqual([])
  })

  test('a copy is finished, unnamed, with the answers given and the source’s person and coins', async () => {
    const uid = `${P}f`
    const [src] = await server.listRoadmaps(uid)
    const relative = {
      placeId: 'cannington',
      place: 'Cannington, Perth',
      relationship: 'Cousin',
      name: 'Anjali',
    } as const
    await db
      .update(schema.roadmap)
      .set({
        answers: { amount: { value: 36, state: 'stated' } },
        coins: { state: 'later' },
        relative,
        choices: { swapped: true },
      })
      .where(orm.eq(schema.roadmap.id, src.id))
    const answers = { amount: { value: 30, state: 'stated' } } as const
    const copy = await server.createRoadmap(uid, { fromId: src.id, answers })
    if (typeof copy === 'string') throw new Error(copy)
    expect(copy).toMatchObject({
      copiedFrom: src.id,
      name: null,
      choices: {},
      lastOpenedAt: null,
      answers,
      relative,
      coins: { state: 'later' },
    })
    expect(copy.id).not.toBe(src.id)
    expect(copy.finishedAt).toBeInstanceOf(Date)
    expect((await server.listRoadmaps(uid)).map((r) => r.id)).toContain(copy.id)
    // Its own answers: the source keeps its own.
    expect((await server.getRoadmap(uid, src.id))?.answers).toEqual({
      amount: { value: 36, state: 'stated' },
    })
  })

  test('a new roadmap takes the person, coins and choices it is given', async () => {
    const uid = `${P}f`
    // The copy just made: never opened, so first on the list; it has a person and coins.
    const [src] = await server.listRoadmaps(uid)
    expect(src.relative).not.toBeNull()
    const made = await server.createRoadmap(uid, {
      fromId: src.id,
      answers: {},
      relative: null,
      coins: null,
      choices: { read: true },
    })
    expect(made).toMatchObject({
      copiedFrom: src.id,
      relative: null,
      coins: null,
      choices: { read: true },
    })
    // Without a source: nobody's copy, no person, no coins.
    expect(await server.createRoadmap(uid, { answers: {} })).toMatchObject({
      copiedFrom: null,
      relative: null,
      coins: null,
      choices: {},
    })
  })

  test('a copy keeps the name it is made with; one from scratch stays unnamed', async () => {
    const uid = `${P}f`
    const [src] = await server.listRoadmaps(uid)
    const copy = await server.createRoadmap(uid, {
      fromId: src.id,
      name: 'Copy of Cyber Security in Perth',
      answers: {},
    })
    if (typeof copy === 'string') throw new Error(copy)
    expect((await rowOf(copy.id))?.name).toBe('Copy of Cyber Security in Perth')
    const scratch = await server.createRoadmap(uid, { answers: {} })
    if (typeof scratch === 'string') throw new Error(scratch)
    expect((await rowOf(scratch.id))?.name).toBeNull()
  })

  test('a bad set of answers makes nothing', async () => {
    const uid = `${P}f`
    const [src] = await server.listRoadmaps(uid)
    const before = (await server.listRoadmaps(uid)).length
    for (const answers of [
      { amount: { value: 24, state: 'stated' }, sneaky: { value: 'x', state: 'stated' } },
      { amount: 24 },
      null,
    ]) {
      expect(await server.createRoadmap(uid, { fromId: src.id, answers })).toBe('bad-answers')
    }
    expect(await server.listRoadmaps(uid)).toHaveLength(before)
  })

  test('archive folds a roadmap away and restore brings it back; the list keeps it, flagged', async () => {
    const uid = `${P}h`
    const first = await finished(uid)
    const second = await finished(uid)
    await server.touchOpened(uid, first.id)
    expect(await server.archiveRoadmap(uid, first.id)).toBe(true)
    const archivedAt = (await rowOf(first.id))?.archivedAt
    expect(archivedAt).toBeInstanceOf(Date)
    // Archived twice changes nothing.
    expect(await server.archiveRoadmap(uid, first.id)).toBe('not-found')
    expect((await rowOf(first.id))?.archivedAt).toEqual(archivedAt ?? null)

    // Same order as before: the last opened first; the archived one flagged, not dropped.
    const list = await server.listRoadmaps(uid)
    expect(list.map((r) => [r.id, r.archivedAt instanceof Date])).toEqual([
      [first.id, true],
      [second.id, false],
    ])
    // Her own roadmap still: its board opens and it can be copied.
    expect((await server.getRoadmap(uid, first.id))?.id).toBe(first.id)
    const copy = await server.createRoadmap(uid, { fromId: first.id, answers: {} })
    expect(copy).toMatchObject({ copiedFrom: first.id, archivedAt: null })

    expect(await server.restoreArchived(uid, first.id)).toBe(true)
    expect((await server.getRoadmap(uid, first.id))?.archivedAt).toBeNull()
    expect(await server.restoreArchived(uid, first.id)).toBe(false)
  })

  test("archive refuses another student's roadmap, a deleted one and her only one out", async () => {
    const uid = `${P}i`
    const a = await finished(uid)
    const b = await finished(uid)
    const c = await finished(uid)
    expect(await server.archiveRoadmap(`${P}h`, a.id)).toBe('not-found')
    expect(await server.restoreArchived(`${P}h`, a.id)).toBe(false)
    expect(await server.softDeleteRoadmap(uid, c.id)).toBe(true)
    expect(await server.archiveRoadmap(uid, c.id)).toBe('not-found')
    expect(await server.archiveRoadmap(uid, a.id)).toBe(true)
    // b is the only one left out of the archive.
    expect(await server.archiveRoadmap(uid, b.id)).toBe('kept-one')
    expect(await rowOf(b.id)).toMatchObject({ archivedAt: null })
    expect(await rowOf(c.id)).toMatchObject({ archivedAt: null })
  })

  test('two archives sent at once leave one roadmap out of the archive', async () => {
    const uid = `${P}k`
    const a = await finished(uid)
    const b = await finished(uid)
    const archived = await Promise.all([
      server.archiveRoadmap(uid, a.id),
      server.archiveRoadmap(uid, b.id),
    ])
    expect(archived.toSorted()).toEqual(['kept-one', true])
    const out = (await server.listRoadmaps(uid)).filter((r) => r.archivedAt === null)
    expect(out).toHaveLength(1)
  })

  test('delete keeps one roadmap out of the archive; an archived one may always go', async () => {
    const uid = `${P}j`
    const active = await finished(uid)
    const a1 = await finished(uid)
    const a2 = await finished(uid)
    const spare = await finished(uid)
    expect(await server.hasArchived(uid)).toBe(false)
    expect(await server.archiveRoadmap(uid, a1.id)).toBe(true)
    expect(await server.hasArchived(uid)).toBe(true)
    expect(await server.hasArchived(`${P}i`)).toBe(true)
    expect(await server.hasArchived(`${P}f`)).toBe(false)
    expect(await server.archiveRoadmap(uid, a2.id)).toBe(true)
    // Two out of the archive: one of them may go.
    expect(await server.softDeleteRoadmap(uid, spare.id)).toBe(true)
    // One out, two archived: the one out stays, an archived one goes.
    expect(await server.softDeleteRoadmap(uid, active.id)).toBe('kept-one')
    expect(await rowOf(active.id)).toMatchObject({ deletedAt: null })
    expect(await server.softDeleteRoadmap(uid, a1.id)).toBe(true)
  })

  test("saving a roadmap's answers replaces them on that roadmap only", async () => {
    const uid = `${P}l`
    const r = await finished(uid)
    const other = await finished(uid)
    await db
      .update(schema.roadmap)
      .set({
        answers: {
          amount: { value: 36, state: 'stated' },
          climate: { value: 'Warm', state: 'stated' },
        },
      })
      .where(orm.inArray(schema.roadmap.id, [r.id, other.id]))
    const answers = {
      amount: { value: 30, state: 'stated' },
      hard: { value: 'Roughly', state: 'assumed' },
    } as const
    expect(await server.saveRoadmapAnswers(uid, r.id, answers)).toBe(true)
    // The whole set: what is not in it (climate) is gone.
    expect((await server.getRoadmap(uid, r.id))?.answers).toEqual(answers)
    expect((await server.getRoadmap(uid, other.id))?.answers).toEqual({
      amount: { value: 36, state: 'stated' },
      climate: { value: 'Warm', state: 'stated' },
    })
  })

  test('a bad entry refuses the whole write', async () => {
    const uid = `${P}l`
    const [r] = await server.listRoadmaps(uid)
    const before = (await rowOf(r.id))?.answers
    const bad: unknown[] = [
      { amount: { value: 24, state: 'stated' }, sneaky: { value: 'x', state: 'stated' } },
      { amount: { value: 24, state: 'stated' }, climate: { value: 'Warm', state: 'sure' } },
      { amount: { value: 24, state: 'stated' }, where: { value: 'x'.repeat(81), state: 'stated' } },
      { amount: 24 },
      null,
      ['amount'],
    ]
    for (const answers of bad) {
      expect(await server.saveRoadmapAnswers(uid, r.id, answers)).toBe('bad-answers')
    }
    expect((await rowOf(r.id))?.answers).toEqual(before)
  })

  test("a roadmap's answers are never written to a draft's or another student's", async () => {
    const uid = `${P}l`
    const draft = await server.ensureDraft(uid)
    const theirs = await finished(`${P}k`)
    const answers = { amount: { value: 24, state: 'stated' } } as const
    expect(await server.saveRoadmapAnswers(uid, draft.id, answers)).toBe('not-found')
    expect(await server.saveRoadmapAnswers(uid, theirs.id, answers)).toBe('not-found')
    expect((await rowOf(draft.id))?.answers).toEqual({})
    expect((await rowOf(theirs.id))?.answers).toEqual({})
  })

  test('deleting the account deletes her roadmaps', async () => {
    const uid = `${P}a`
    await db.delete(schema.user).where(orm.eq(schema.user.id, uid))
    expect(
      await db.select().from(schema.roadmap).where(orm.eq(schema.roadmap.userId, uid)),
    ).toEqual([])
  })
})
