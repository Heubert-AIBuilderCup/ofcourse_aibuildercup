import 'server-only'
import { makeSignature } from 'better-auth/crypto'
import { eq } from 'drizzle-orm'
import { savePersona } from '@/features/opening/server/profile'
import { createRoadmap } from '@/features/roadmaps/server/roadmaps'
import type { JudgeStory } from '@/features/roads'
import { auth } from '@/shared/lib/auth'
import type { Surface } from '@/shared/lib/auth/access'
import { adminHome } from '@/shared/lib/auth/gate'
import { runWithSurface } from '@/shared/lib/auth/surface'
import { db, schema } from '@/shared/lib/db'
import {
  JUDGE_ADMIN,
  judgeStudentEmail,
  judgeStudentLanding,
  judgeStudentName,
} from '../model/accounts'

// The judges' sign-ins, once the passcode is through (../actions). Each account is made through
// Better Auth's internal adapter, as Google and the dev sign-in make one, so the sign-up and
// session hooks run (auth/index.ts). They are made on the student page's rules, which make a user
// and nothing more, even on an empty database: no judge ever becomes superadmin by the
// first-account rule, and an address an admin role waits for is refused. The session then opens
// on the page the judge lands in, whose hook checks the account belongs there.

/** The signed session cookie to set, as Better Auth sets it after a Google sign-in. */
export type SessionCookie = {
  name: string
  value: string
  options: {
    path: string
    httpOnly: boolean
    secure: boolean
    sameSite: 'lax'
    maxAge: number | undefined
  }
}

export type JudgeSignIn = { userId: string; to: string; cookie: SessionCookie }

const signedUp = { method: 'judge' }

/** A session for the account, opened on `surface` (its hook refuses a suspended account). */
async function openSession(userId: string, surface: Surface): Promise<SessionCookie> {
  const ctx = await auth.$context
  const session = await runWithSurface(surface, () =>
    ctx.internalAdapter.createSession(userId, false),
  )
  const cookie = ctx.authCookies.sessionToken
  return {
    name: cookie.name,
    value: `${session.token}.${await makeSignature(session.token, ctx.secret)}`,
    options: {
      path: cookie.attributes.path ?? '/',
      httpOnly: cookie.attributes.httpOnly ?? true,
      secure: cookie.attributes.secure ?? false,
      sameSite: 'lax',
      maxAge: cookie.attributes.maxAge,
    },
  }
}

/** A new account on the student page's rules: a user with no capability. */
async function newUser(email: string, name: string): Promise<string> {
  const ctx = await auth.$context
  const user = await runWithSurface('student', () =>
    ctx.internalAdapter.createUser({ email, name, emailVerified: true }, signedUp),
  )
  return user.id
}

/** The admin judge's account id, made on first use; a sign-up racing this one is found after. */
async function adminJudgeId(): Promise<string> {
  const ctx = await auth.$context
  const find = async () => (await ctx.internalAdapter.findUserByEmail(JUDGE_ADMIN.email))?.user.id
  const found = await find()
  if (found) return found
  try {
    return await newUser(JUDGE_ADMIN.email, JUDGE_ADMIN.name)
  } catch (error) {
    const raced = await find()
    if (raced) return raced
    throw error
  }
}

/**
 * The shared admin judge, signed in: the account made once, then given the editor and reviewer
 * capabilities with the role user, every time, so an account someone promoted is put back and the
 * passcode never opens Users or Models. It lands on the Board.
 */
export async function signInJudgeAdmin(): Promise<JudgeSignIn> {
  const userId = await adminJudgeId()
  const { role, editor, reviewer } = JUDGE_ADMIN.grants
  await db.update(schema.user).set({ role, editor, reviewer }).where(eq(schema.user.id, userId))
  return { userId, to: adminHome(JUDGE_ADMIN.grants), cookie: await openSession(userId, 'admin') }
}

/**
 * A fresh student judge, signed in. With a story: her picture, then her first roadmap, finished
 * with the story's answers, person and coins (so onboarding is closed), and she lands on it; with
 * none she starts from the beginning, on the welcome.
 */
export async function signInJudgeStudent(story: JudgeStory | null): Promise<JudgeSignIn> {
  const userId = await newUser(judgeStudentEmail(), judgeStudentName(story?.name ?? null))
  let roadmapId: string | null = null
  if (story) {
    await savePersona(userId, story.persona)
    const made = await createRoadmap(userId, {
      answers: story.answers,
      relative: story.relative,
      coins: story.coins,
    })
    if (typeof made === 'string') throw new Error(`judge: story "${story.id}" was refused: ${made}`)
    roadmapId = made.id
  }
  return {
    userId,
    to: judgeStudentLanding(roadmapId),
    cookie: await openSession(userId, 'student'),
  }
}
