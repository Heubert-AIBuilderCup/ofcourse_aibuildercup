// Targeted updates against the development database (Docker, port 5433); off by default so the
// suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/updates/server/updates.test.ts
// Every account here has an id starting `up-` and is deleted after, with the updates it wrote.

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { ALL_TOPICS } from '../lib/audience'
import { DEMO_DRAFT } from '../lib/update'

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const P = 'up-'

type User = { id: string; role: string; editor: boolean; reviewer: boolean; name: string }
const ED: User = { id: `${P}ed`, role: 'user', editor: true, reviewer: false, name: 'UP ed' }
const REV: User = { id: `${P}rev`, role: 'user', editor: false, reviewer: true, name: 'UP rev' }
const ADMIN: User = { id: `${P}admin`, role: 'admin', editor: false, reviewer: false, name: 'UP a' }

describe.skipIf(!enabled)('targeted updates against the database', () => {
  let updates: typeof import('./updates')
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db/schema')
  let orm: typeof import('drizzle-orm')
  let notAuthorised: string

  async function cleanUp() {
    await db.delete(schema.adminUpdate).where(orm.like(schema.adminUpdate.createdByUserId, `${P}%`))
    await db.delete(schema.user).where(orm.like(schema.user.id, `${P}%`))
  }

  const statusOf = async (id: string) =>
    (
      await db
        .select({ status: schema.adminUpdate.status, by: schema.adminUpdate.approvedByUserId })
        .from(schema.adminUpdate)
        .where(orm.eq(schema.adminUpdate.id, id))
    )[0] ?? null

  async function draft(): Promise<string> {
    const res = await updates.createUpdate(ED, DEMO_DRAFT)
    if (!res.ok) throw new Error(res.error)
    return res.id
  }

  beforeAll(async () => {
    updates = await import('./updates')
    db = (await import('@/shared/lib/db')).db
    schema = await import('@/shared/lib/db/schema')
    orm = await import('drizzle-orm')
    notAuthorised = (await import('@/shared/lib/auth/access')).ACCESS_ERRORS.notAuthorised
    await cleanUp()
    await db.insert(schema.user).values(
      [ED, REV, ADMIN].map((u) => ({
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

  test('an editor saves a draft and sends it to review; a reviewer approves it, and it is live', async () => {
    const id = await draft()
    expect(await statusOf(id)).toEqual({ status: 'draft', by: null })
    expect(await updates.sendUpdateToReview(ED, id)).toEqual({ ok: true })
    expect((await statusOf(id))?.status).toBe('in_review')
    expect(await updates.approveUpdate(REV, id)).toEqual({ ok: true })
    expect(await statusOf(id)).toEqual({ status: 'live', by: REV.id })

    const listed = (await updates.listUpdates()).find((u) => u.id === id)
    expect(listed?.status).toBe('live')
    expect(listed?.audience).toEqual(DEMO_DRAFT.audience)
    expect(listed?.applyBy).toBe(DEMO_DRAFT.applyBy)
    const latest = await updates.latestLiveUpdate()
    expect(latest?.id).toBe(id)
  })

  test('the live read returns live updates only, never a draft or one in review', async () => {
    const [drafted, reviewing, live] = [await draft(), await draft(), await draft()]
    await updates.sendUpdateToReview(ED, reviewing)
    await updates.sendUpdateToReview(ED, live)
    await updates.approveUpdate(REV, live)

    const ids = (await updates.listLiveUpdates()).map((u) => u.id)
    expect(ids).toContain(live)
    expect(ids).not.toContain(drafted)
    expect(ids).not.toContain(reviewing)
  })

  test('someone who is not a reviewer cannot approve, and a draft not in review cannot be approved', async () => {
    const id = await draft()
    await updates.sendUpdateToReview(ED, id)
    for (const actor of [ED, ADMIN]) {
      expect(await updates.approveUpdate(actor, id)).toEqual({ ok: false, error: notAuthorised })
    }
    expect((await statusOf(id))?.status).toBe('in_review')

    const still = await draft()
    expect(await updates.approveUpdate(REV, still)).toEqual({
      ok: false,
      error: updates.UPDATE_FLOW_ERRORS.notInReview,
    })
    expect((await statusOf(still))?.status).toBe('draft')
  })

  test('someone who is not an editor cannot create an update or send one to review', async () => {
    for (const actor of [REV, ADMIN]) {
      expect(await updates.createUpdate(actor, DEMO_DRAFT)).toEqual({
        ok: false,
        error: notAuthorised,
      })
    }
    const id = await draft()
    expect(await updates.sendUpdateToReview(REV, id)).toEqual({ ok: false, error: notAuthorised })
    expect((await statusOf(id))?.status).toBe('draft')
  })

  test('a topic is stored and read back, in the list and once live', async () => {
    const res = await updates.createUpdate(ED, {
      ...DEMO_DRAFT,
      audience: { ...DEMO_DRAFT.audience, topic: 'data' },
    })
    if (!res.ok) throw new Error(res.error)
    const listed = (await updates.listUpdates()).find((u) => u.id === res.id)
    expect(listed?.audience.topic).toBe('data')
    await updates.sendUpdateToReview(ED, res.id)
    await updates.approveUpdate(REV, res.id)
    const live = (await updates.listLiveUpdates()).find((u) => u.id === res.id)
    expect(live?.audience.topic).toBe('data')
  })

  test('an audience stored before topics reads as all topics', async () => {
    const id = `${P}${crypto.randomUUID()}`
    const { audience: _audience, ...fields } = DEMO_DRAFT
    await db.insert(schema.adminUpdate).values({
      id,
      ...fields,
      audience: { institution: 'ECU', homeCountry: null },
      status: 'draft',
      createdByUserId: ED.id,
    })
    const listed = (await updates.listUpdates()).find((u) => u.id === id)
    expect(listed?.audience).toEqual({ institution: 'ECU', homeCountry: null, topic: ALL_TOPICS })
  })

  test('an update with a field that breaks its rules is refused by name, and nothing is saved', async () => {
    const before = (await updates.listUpdates()).length
    expect(await updates.createUpdate(ED, { ...DEMO_DRAFT, title: '' })).toEqual({
      ok: false,
      error: 'Give it a title, up to 120 characters.',
    })
    expect((await updates.listUpdates()).length).toBe(before)
  })
})
