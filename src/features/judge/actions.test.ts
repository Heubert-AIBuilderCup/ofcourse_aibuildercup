// The judges' sign-in actions with the sign-ins, the request and the redirect mocked: off, a wrong
// passcode and too many tries are refused before any account is made; the right passcode signs in
// (the cookie set, then one redirect to the landing). The sign-ins themselves are proven against
// the database in ./server/sign-in.test.ts.

import { afterAll, afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import * as navigation from 'next/navigation'
import type { JudgeStory } from '@/features/roads'
import { TOO_MANY_TRIES, WRONG_PASSCODE } from './model/passcode'
import type { JudgeSignIn } from './server/sign-in'

const signedIn = (to: string): JudgeSignIn => ({
  userId: 'u-1',
  to,
  cookie: {
    name: 'better-auth.session_token',
    value: 'token.signature',
    options: { path: '/', httpOnly: true, secure: false, sameSite: 'lax', maxAge: 600 },
  },
})
const signInJudgeAdmin = mock(async () => signedIn('/admin/board'))
const signInJudgeStudent = mock(async (story: JudgeStory | null) =>
  signedIn(story ? `/roadmaps/rm-${story.id}` : '/onboarding/welcome'),
)
mock.module('./server/sign-in', () => ({ signInJudgeAdmin, signInJudgeStudent }))

/** The client address the request comes from; each test takes its own, so counts never mix. */
let address = '203.0.113.1'
const set = mock((_name: string, _value: string, _options: object) => {})
mock.module('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': address }),
  cookies: async () => ({ set, delete: () => {} }),
}))
const redirect = mock((_to: string) => {})
mock.module('next/navigation', () => ({ ...navigation, redirect }))

const { judgeAdminSignInAction, judgeStudentSignInAction } = await import('./actions')

const env = process.env as Record<string, string | undefined>
const saved = env.JUDGE_PASSCODE
afterAll(() => {
  if (saved === undefined) delete env.JUDGE_PASSCODE
  else env.JUDGE_PASSCODE = saved
})

const form = (fields: Record<string, string | undefined>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) data.set(key, value)
  return data
}

let n = 0
beforeEach(() => {
  env.JUDGE_PASSCODE = 'cup-2026'
  n += 1
  address = `203.0.113.${n}`
})
afterEach(() => {
  for (const m of [signInJudgeAdmin, signInJudgeStudent, set, redirect]) m.mockClear()
})

/** Nothing was signed in: no account made, no cookie, no redirect. */
const nothingSignedIn = () => {
  expect(signInJudgeAdmin).not.toHaveBeenCalled()
  expect(signInJudgeStudent).not.toHaveBeenCalled()
  expect(set).not.toHaveBeenCalled()
  expect(redirect).not.toHaveBeenCalled()
}

describe('judge access off', () => {
  test('without a passcode set, both refuse whatever is sent', async () => {
    delete env.JUDGE_PASSCODE
    expect(await judgeAdminSignInAction(null, form({ passcode: 'cup-2026' }))).toEqual({
      ok: false,
      error: WRONG_PASSCODE,
    })
    env.JUDGE_PASSCODE = ''
    expect(await judgeStudentSignInAction(null, form({ passcode: '', story: 'priya' }))).toEqual({
      ok: false,
      error: WRONG_PASSCODE,
    })
    nothingSignedIn()
  })
})

describe('the admin judge', () => {
  test('a wrong or missing passcode is refused with the sentence', async () => {
    for (const fields of [{ passcode: 'nope' }, {}]) {
      expect(await judgeAdminSignInAction(null, form(fields))).toEqual({
        ok: false,
        error: WRONG_PASSCODE,
      })
    }
    nothingSignedIn()
  })

  test('past ten tries from one address, even the right passcode is refused', async () => {
    for (let i = 0; i < 10; i++) await judgeAdminSignInAction(null, form({ passcode: `x${i}` }))
    expect(await judgeAdminSignInAction(null, form({ passcode: 'cup-2026' }))).toEqual({
      ok: false,
      error: TOO_MANY_TRIES,
    })
    nothingSignedIn()
  })

  test('the right passcode signs in: the cookie, then the Board', async () => {
    await judgeAdminSignInAction(null, form({ passcode: 'cup-2026' }))
    expect(signInJudgeAdmin).toHaveBeenCalledTimes(1)
    expect(set.mock.calls[0]?.slice(0, 2)).toEqual(['better-auth.session_token', 'token.signature'])
    expect(redirect.mock.calls).toEqual([['/admin/board']])
  })

  test('a sign-in that fails is said, never thrown', async () => {
    const log = spyOn(console, 'error').mockImplementation(() => {})
    signInJudgeAdmin.mockImplementationOnce(async () => {
      throw new Error('suspended')
    })
    const result = await judgeAdminSignInAction(null, form({ passcode: 'cup-2026' }))
    log.mockRestore()
    expect(result?.ok).toBe(false)
    expect(set).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })
})

describe('the student judge', () => {
  test('a wrong passcode is refused with the sentence, whatever story was chosen', async () => {
    expect(
      await judgeStudentSignInAction(null, form({ passcode: 'nope', story: 'priya' })),
    ).toEqual({ ok: false, error: WRONG_PASSCODE })
    nothingSignedIn()
  })

  test('a story signs in as a new student with that story, on to her roadmap', async () => {
    await judgeStudentSignInAction(null, form({ passcode: 'cup-2026', story: 'sita' }))
    expect(signInJudgeStudent.mock.calls.map(([s]) => s?.id ?? null)).toEqual(['sita'])
    expect(set).toHaveBeenCalledTimes(1)
    expect(redirect.mock.calls).toEqual([['/roadmaps/rm-sita']])
  })

  test('"Start from the beginning" signs in a new student with no story, on to the welcome', async () => {
    await judgeStudentSignInAction(null, form({ passcode: 'cup-2026', story: 'fresh' }))
    expect(signInJudgeStudent.mock.calls.map(([s]) => s?.id ?? null)).toEqual([null])
    expect(redirect.mock.calls).toEqual([['/onboarding/welcome']])
  })

  test('an unknown or missing story is refused, and no account is made', async () => {
    for (const fields of [{ passcode: 'cup-2026', story: 'nobody' }, { passcode: 'cup-2026' }]) {
      const result = await judgeStudentSignInAction(null, form(fields))
      expect(result?.ok).toBe(false)
    }
    nothingSignedIn()
  })
})
