// The judges' sign-ins against the development database (Docker, port 5433), through Better Auth's
// own internal adapter so the sign-up and session hooks run as they do for Google; off by default
// so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/judge/server/sign-in.test.ts
// The admin judge is created once, a user with editor and reviewer, never admin or superadmin (on
// an empty table too); each student sign-in makes a new account; a story's roadmap is finished and
// holds the story. Every student judge made here is deleted after, and the admin judge too unless
// it was there before.

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { eq, inArray, sql } from 'drizzle-orm'
import { judgeStoryById } from '@/features/roads/data/judge-stories'
import * as schema from '@/shared/lib/db/schema'
import { JUDGE_ADMIN, JUDGE_DOMAIN } from '../model/accounts'

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'

let db: typeof import('@/shared/lib/db').db

const adminRow = async () => {
  const rows = await db
    .select({
      id: schema.user.id,
      role: schema.user.role,
      editor: schema.user.editor,
      reviewer: schema.user.reviewer,
    })
    .from(schema.user)
    .where(eq(schema.user.email, JUDGE_ADMIN.email))
    .limit(2)
  return rows
}

// Whether the database held accounts, and the admin judge, when this file started: the
// first-account case can be proven only on an empty table.
let hadAccounts = true
let hadAdminJudge = true
if (enabled) {
  ;({ db } = await import('@/shared/lib/db'))
  hadAccounts = (await db.select({ one: sql`1` }).from(schema.user).limit(1)).length > 0
  hadAdminJudge = (await adminRow()).length > 0
}

describe.skipIf(!enabled)('judge sign-ins against the database', () => {
  const env = process.env as Record<string, string | undefined>
  let signIn: typeof import('./sign-in')
  let roadmaps: typeof import('@/features/roadmaps/server/roadmaps')
  let profile: typeof import('@/features/opening/server/profile')
  /** The student judges this file made. */
  const made: string[] = []

  beforeAll(async () => {
    // Better Auth needs a base URL to build its context; nothing here makes a request.
    env.BETTER_AUTH_URL ||= 'http://localhost:3000'
    signIn = await import('./sign-in')
    roadmaps = await import('@/features/roadmaps/server/roadmaps')
    profile = await import('@/features/opening/server/profile')
  })

  afterAll(async () => {
    if (made.length > 0) await db.delete(schema.user).where(inArray(schema.user.id, made))
    if (!hadAdminJudge) await db.delete(schema.user).where(eq(schema.user.email, JUDGE_ADMIN.email))
  })

  /** The session the cookie carries belongs to this account. */
  async function sessionOwner(cookieValue: string): Promise<string | undefined> {
    const token = cookieValue.split('.')[0]
    const [row] = await db
      .select({ userId: schema.session.userId })
      .from(schema.session)
      .where(eq(schema.session.token, token))
      .limit(1)
    return row?.userId
  }

  const account = async (id: string) => {
    const [row] = await db
      .select({
        email: schema.user.email,
        name: schema.user.name,
        role: schema.user.role,
        editor: schema.user.editor,
        reviewer: schema.user.reviewer,
      })
      .from(schema.user)
      .where(eq(schema.user.id, id))
      .limit(1)
    return row
  }

  test.skipIf(hadAccounts)('the admin judge is no superadmin on an empty table', async () => {
    const { userId } = await signIn.signInJudgeAdmin()
    expect(await account(userId)).toMatchObject({ role: 'user', editor: true, reviewer: true })
  })

  test('the admin judge is created once, a user with editor and reviewer, landing on the Board', async () => {
    const first = await signIn.signInJudgeAdmin()
    const second = await signIn.signInJudgeAdmin()
    expect(second.userId).toBe(first.userId)
    expect(first.to).toBe('/admin/board')
    const rows = await adminRow()
    expect(rows.length).toBe(1)
    expect(rows[0]).toMatchObject({ role: 'user', editor: true, reviewer: true })
    expect(await account(first.userId)).toMatchObject({ name: 'Judge (admin)' })
    expect(await sessionOwner(second.cookie.value)).toBe(first.userId)
  })

  test('an admin judge someone made admin or superadmin is a user again at its next sign-in', async () => {
    for (const role of ['admin', 'superadmin'] as const) {
      await db.update(schema.user).set({ role }).where(eq(schema.user.email, JUDGE_ADMIN.email))
      const { userId } = await signIn.signInJudgeAdmin()
      expect((await account(userId))?.role).toBe('user')
    }
  })

  test('each student sign-in makes a new student, landing on the welcome', async () => {
    const a = await signIn.signInJudgeStudent(null)
    const b = await signIn.signInJudgeStudent(null)
    made.push(a.userId, b.userId)
    expect(a.userId).not.toBe(b.userId)
    expect(a.to).toBe('/onboarding/welcome')
    for (const { userId, cookie } of [a, b]) {
      const row = await account(userId)
      expect(row).toMatchObject({ role: 'user', editor: false, reviewer: false })
      expect(row?.name).toBe('Judge · New student')
      expect(row?.email.endsWith(`@${JUDGE_DOMAIN}`)).toBe(true)
      expect(await sessionOwner(cookie.value)).toBe(userId)
      expect(await roadmaps.listRoadmaps(userId)).toEqual([])
    }
  })

  test("a story's student lands on her first roadmap, finished, holding the story", async () => {
    const story = judgeStoryById('priya')
    if (!story) throw new Error('No Priya')
    const { userId, to } = await signIn.signInJudgeStudent(story)
    made.push(userId)
    expect((await account(userId))?.name).toBe('Judge · Priya')
    const list = await roadmaps.listRoadmaps(userId)
    expect(list.length).toBe(1)
    const [roadmap] = list
    expect(to).toBe(`/roadmaps/${roadmap.id}`)
    expect(roadmap.finishedAt).not.toBeNull()
    expect(roadmap.answers).toEqual(story.answers)
    expect(roadmap.relative).toEqual(story.relative)
    expect(roadmap.coins).toEqual(story.coins)
    const p = await profile.getProfile(userId)
    expect(p.persona).toBe(story.persona)
    // Onboarding is closed: no roadmap being answered, one finished.
    expect(p.draft).toBeNull()
    expect(p.finished).toBe(1)
  })
})
