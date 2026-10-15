// The Ideas queue's decisions against the development database (Docker, port 5433); off by default
// so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/content/server/ideas-queue.test.ts
// The model layer is the fake provider (AI_PROVIDER=fake) on the real call log and cache, with this
// run's own model names. Every account here has an id starting `iq-` and is deleted after, with the
// posts it made, their call log rows and the decisions on the queue's ideas.

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { randomUUID } from 'node:crypto'

process.env.AI_PROVIDER = 'fake'
process.env.AI_DAILY_CAP_PRO = '100000'
process.env.GEMINI_FLASH_MODEL = `iq-flash-${randomUUID()}`
process.env.GEMINI_PRO_MODEL = `iq-pro-${randomUUID()}`

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const P = 'iq-'
const SLOW = 60_000

type User = { id: string; role: string; editor: boolean; reviewer: boolean; name: string }
const ED: User = { id: `${P}ed`, role: 'user', editor: true, reviewer: false, name: 'IQ ed' }
const REV: User = { id: `${P}rev`, role: 'user', editor: false, reviewer: true, name: 'IQ rev' }
const ADMIN: User = { id: `${P}admin`, role: 'admin', editor: false, reviewer: false, name: 'IQ a' }

describe.skipIf(!enabled)('the Ideas queue against the database', () => {
  let queue: typeof import('./ideas-queue')
  let commands: typeof import('./commands')
  let ideas: typeof import('../ideas-queue')
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db/schema')
  let orm: typeof import('drizzle-orm')
  let notAuthorised: string
  let paidWork: { title: string; kind: string; text: string }
  const posts: string[] = []

  async function cleanUp() {
    await db.delete(schema.contentIdeaDecision)
    await db.delete(schema.contentPost).where(orm.like(schema.contentPost.createdByUserId, `${P}%`))
    if (posts.length > 0) {
      await db.delete(schema.aiCall).where(orm.inArray(schema.aiCall.postId, posts))
    }
    await db.delete(schema.aiCache).where(orm.like(schema.aiCache.model, `${P}%`))
    await db.delete(schema.user).where(orm.like(schema.user.id, `${P}%`))
  }

  const contentIdea = () => {
    const found = ideas.IDEAS.find((i) => i.group === 'content')
    if (!found) throw new Error('no content idea')
    return found
  }
  const expansionIdea = () => {
    const found = ideas.IDEAS.find((i) => i.group === 'expansion')
    if (!found) throw new Error('no expansion idea')
    return found
  }
  const decisionOf = async (ideaId: string) =>
    (
      await db
        .select()
        .from(schema.contentIdeaDecision)
        .where(orm.eq(schema.contentIdeaDecision.ideaId, ideaId))
    )[0] ?? null

  beforeAll(async () => {
    queue = await import('./ideas-queue')
    commands = await import('./commands')
    ideas = await import('../ideas-queue')
    db = (await import('@/shared/lib/db')).db
    schema = await import('@/shared/lib/db/schema')
    orm = await import('drizzle-orm')
    notAuthorised = (await import('@/shared/lib/auth/access')).ACCESS_ERRORS.notAuthorised
    // No request here for after(): run each task at once.
    ;(await import('./after')).scheduleWith((task) => void task())
    const { DEMO_SOURCES } = await import('../demo-sources')
    const demo = DEMO_SOURCES.find((s) => s.key === 'paid-work')
    if (!demo) throw new Error('demo source missing')
    paidWork = { title: demo.title, kind: demo.kind, text: demo.text }
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

  beforeEach(async () => {
    await db.delete(schema.contentIdeaDecision)
  })

  afterAll(async () => {
    await cleanUp()
  })

  test(
    'accepting a content idea, then making the post it starts, records the post on the idea',
    async () => {
      const idea = contentIdea()
      const accepted = await queue.decideIdea(ED, idea.id, 'accepted')
      expect(accepted).toEqual({ ok: true, href: ideas.ideaStartHref(idea) })
      expect((await decisionOf(idea.id))?.decision).toBe('accepted')

      // The New post form, started from the idea, makes the post as from links (BR13).
      const requestId = randomUUID()
      posts.push(requestId)
      const made = await commands.makePost(ED, { requestId, ...paidWork })
      expect(made.ok).toBe(true)
      expect(await queue.recordIdeaPost(ED, idea.id, requestId)).toEqual({ ok: true })

      const saved = await decisionOf(idea.id)
      expect(saved?.postId).toBe(requestId)
      expect(saved?.decidedByUserId).toBe(ED.id)
      const [post] = await db
        .select({ id: schema.contentPost.id })
        .from(schema.contentPost)
        .where(orm.eq(schema.contentPost.id, requestId))
      expect(post?.id).toBe(requestId)
      expect(await queue.listIdeaDecisions()).toContainEqual({
        ideaId: idea.id,
        decision: 'accepted',
        postId: requestId,
      })
    },
    SLOW,
  )

  test('accepting an expansion idea records it and starts no post', async () => {
    const idea = expansionIdea()
    expect(await queue.decideIdea(ED, idea.id, 'accepted')).toEqual({ ok: true, href: null })
    const saved = await decisionOf(idea.id)
    expect(saved?.decision).toBe('accepted')
    expect(saved?.postId).toBeNull()
  })

  test('dismissing an idea hides it from the queue', async () => {
    const idea = contentIdea()
    expect(await queue.decideIdea(ED, idea.id, 'dismissed')).toEqual({ ok: true, href: null })
    const rows = ideas.queueRows(ideas.IDEAS, await queue.listIdeaDecisions())
    expect(rows.map((r) => r.idea.id)).not.toContain(idea.id)
    expect(rows).toHaveLength(ideas.IDEAS.length - 1)
  })

  test('a reviewer or an admin without a capability is refused, and nothing is recorded', async () => {
    const idea = contentIdea()
    for (const actor of [REV, ADMIN]) {
      expect(await queue.decideIdea(actor, idea.id, 'accepted')).toEqual({
        ok: false,
        error: notAuthorised,
      })
      expect(await queue.decideIdea(actor, idea.id, 'dismissed')).toEqual({
        ok: false,
        error: notAuthorised,
      })
    }
    expect(await decisionOf(idea.id)).toBeNull()
  })

  test('an unknown idea is refused, and a post is recorded only on an accepted idea', async () => {
    expect(await queue.decideIdea(ED, 'nope', 'accepted')).toEqual({
      ok: false,
      error: queue.IDEA_ERRORS.unknown,
    })
    const idea = contentIdea()
    await queue.decideIdea(ED, idea.id, 'dismissed')
    expect(await queue.recordIdeaPost(ED, idea.id, randomUUID())).toEqual({ ok: true })
    expect((await decisionOf(idea.id))?.postId).toBeNull()
    expect(await queue.recordIdeaPost(REV, idea.id, randomUUID())).toEqual({
      ok: false,
      error: notAuthorised,
    })
  })
})
