// A post's owner and note on the board against the development database (Docker, port 5433); off
// by default so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/content/server/assign.test.ts
// Every post and user here has an id starting `as-` and is deleted after.

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { emptyPointers } from '../model/artifacts'

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const P = 'as-'

type User = { id: string; role: string; editor: boolean; reviewer: boolean; name: string }
const ED: User = { id: `${P}ed`, role: 'user', editor: true, reviewer: false, name: 'AS ed' }
const REV: User = { id: `${P}rev`, role: 'user', editor: false, reviewer: true, name: 'AS rev' }
const ADMIN: User = {
  id: `${P}admin`,
  role: 'admin',
  editor: false,
  reviewer: false,
  name: 'AS admin',
}
const STUDENT: User = {
  id: `${P}student`,
  role: 'user',
  editor: false,
  reviewer: false,
  name: 'AS student',
}

describe.skipIf(!enabled)('assigning a post against the database', () => {
  let assign: typeof import('./assign')
  let store: typeof import('./store')
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db/schema')
  let orm: typeof import('drizzle-orm')
  let errors: typeof import('../lib/board').ASSIGN_ERRORS
  const EDITED = new Date('2026-10-01T08:00:00.000Z')

  async function cleanUp() {
    await db.delete(schema.contentPost).where(orm.like(schema.contentPost.createdByUserId, `${P}%`))
    await db.delete(schema.user).where(orm.like(schema.user.id, `${P}%`))
  }

  async function newPost(): Promise<string> {
    const id = randomUUID()
    await db.insert(schema.contentPost).values({
      id,
      kind: 'feed',
      title: 'Assign test',
      stage: 'structures',
      pointers: emptyPointers(),
      createdByUserId: ED.id,
      updatedByUserId: ED.id,
      updatedAt: EDITED,
    })
    return id
  }

  async function row(id: string) {
    const [found] = await db
      .select()
      .from(schema.contentPost)
      .where(orm.eq(schema.contentPost.id, id))
    if (!found) throw new Error(`post ${id} missing`)
    return found
  }

  beforeAll(async () => {
    assign = await import('./assign')
    store = await import('./store')
    db = (await import('@/shared/lib/db')).db
    schema = await import('@/shared/lib/db/schema')
    orm = await import('drizzle-orm')
    errors = (await import('../lib/board')).ASSIGN_ERRORS
    await cleanUp()
    await db.insert(schema.user).values(
      [ED, REV, ADMIN, STUDENT].map((u) => ({
        id: u.id,
        name: u.name,
        email: `${u.id}@example.test`,
        role: u.role as 'user' | 'admin',
        editor: u.editor,
        reviewer: u.reviewer,
      })),
    )
  })

  afterAll(async () => {
    await cleanUp()
  })

  test('an editor assigns with a note: stored with the assigner and the time, the post not edited', async () => {
    const id = await newPost()
    const before = Date.now()
    const res = await assign.assignPost(ED, { postId: id, assigneeId: REV.id, note: '  Draw it  ' })
    expect(res).toEqual({ ok: true })
    const saved = await row(id)
    expect(saved.assigneeUserId).toBe(REV.id)
    expect(saved.assignmentNote).toBe('Draw it')
    expect(saved.assignedByUserId).toBe(ED.id)
    expect(saved.assignedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000)
    expect(saved.updatedAt.toISOString()).toBe(EDITED.toISOString())
    expect(saved.updatedByUserId).toBe(ED.id)
    // The board reads the owner's name and the note.
    const card = (await store.listCards()).find((c) => c.id === id)
    expect(card?.assigneeId).toBe(REV.id)
    expect(card?.assigneeName).toBe('AS rev')
    expect(card?.assignmentNote).toBe('Draw it')
  })

  test('a reviewer who is not an editor is refused, and nothing changes', async () => {
    const id = await newPost()
    const res = await assign.assignPost(REV, { postId: id, assigneeId: REV.id, note: '' })
    expect(res).toEqual({ ok: false, error: errors.notAuthorised })
    expect((await row(id)).assigneeUserId).toBeNull()
  })

  test('an assignee who is not an editor, a reviewer or a superadmin is refused', async () => {
    const id = await newPost()
    // A plain admin sees the board read-only: no capability, so no post to own.
    for (const assigneeId of [ADMIN.id, STUDENT.id, `${P}nobody`]) {
      const res = await assign.assignPost(ED, { postId: id, assigneeId, note: '' })
      expect(res).toEqual({ ok: false, error: errors.assignee })
    }
    expect((await row(id)).assigneeUserId).toBeNull()
  })

  test('a note of 281 characters is refused, and 280 Nepali characters are kept', async () => {
    const id = await newPost()
    const long = await assign.assignPost(ED, {
      postId: id,
      assigneeId: ED.id,
      note: 'a'.repeat(281),
    })
    expect(long).toEqual({ ok: false, error: errors.note })
    // "कि" is one character as a reader sees it, and two code points.
    const nepali = 'कि'.repeat(280)
    const res = await assign.assignPost(ED, { postId: id, assigneeId: ED.id, note: nepali })
    expect(res).toEqual({ ok: true })
    expect((await row(id)).assignmentNote).toBe(nepali)
  })

  test('clearing the owner clears the note too, and an empty note is none', async () => {
    const id = await newPost()
    await assign.assignPost(ED, { postId: id, assigneeId: REV.id, note: 'Yours' })
    expect(await assign.assignPost(ED, { postId: id, assigneeId: null, note: 'Left' })).toEqual({
      ok: true,
    })
    const cleared = await row(id)
    expect(cleared.assigneeUserId).toBeNull()
    expect(cleared.assignmentNote).toBeNull()
    await assign.assignPost(ED, { postId: id, assigneeId: REV.id, note: '   ' })
    expect((await row(id)).assignmentNote).toBeNull()
  })

  test('an unknown post is refused', async () => {
    const res = await assign.assignPost(ED, { postId: randomUUID(), assigneeId: null, note: '' })
    expect(res).toEqual({ ok: false, error: errors.unknown })
  })

  test("the board reads a post's language from its source, and its page from its pointers", async () => {
    const id = await newPost()
    const sourceId = await db.transaction((tx) =>
      store.putArtifact(tx, {
        kind: 'source',
        postId: id,
        actorId: ED.id,
        body: {
          title: 'Assign test',
          kind: 'article',
          text: 'One.',
          paragraphs: [{ ref: '¶1', text: 'One.' }],
          demoKey: null,
          language: 'ne',
        },
      }),
    )
    await db
      .update(schema.contentPost)
      .set({ pointers: { ...emptyPointers(), sourceId, pageBrandId: 'cerebral' } })
      .where(orm.eq(schema.contentPost.id, id))
    const card = (await store.listCards()).find((c) => c.id === id)
    expect(card?.language).toBe('ne')
    expect(card?.pageId).toBe('cerebral')
    // A post with no source reads as English.
    const bare = await newPost()
    expect((await store.listCards()).find((c) => c.id === bare)?.language).toBe('en')
  })

  test('the board staff are the editors, reviewers and superadmins, by name, with no email', async () => {
    const staff = (await assign.listBoardStaff()).filter((s) => s.id.startsWith(P))
    expect(staff).toEqual([
      { id: ED.id, name: 'AS ed' },
      { id: REV.id, name: 'AS rev' },
    ])
  })
})
