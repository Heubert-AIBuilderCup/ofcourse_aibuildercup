'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { type JudgeStory, judgeStoryById } from '@/features/roads'
import { clientAddress, rateLimiter } from '@/shared/lib/rate-limit'
import type { ActionResult } from '@/shared/types/action-result'
import { FRESH_START } from './model/accounts'
import { JUDGE_ATTEMPTS, judgeAttempt } from './model/passcode'
import { type JudgeSignIn, signInJudgeAdmin, signInJudgeStudent } from './server/sign-in'

// The judges' way in, from the two sign-in pages' "Judge access" dialogs. Anyone can call these,
// so each checks the passcode first (counted per client address, ./model/passcode) and makes no
// account before it is through; with JUDGE_PASSCODE unset every call is refused. A sign-in that
// fails is logged and said, never thrown. Once signed in, the one redirect to where the judge
// lands: Next answers it in the action's response, so nothing is painted in between.

const CHOOSE_STORY = 'Choose a story, or start from the beginning.'
const UNAVAILABLE = "Judge access isn't available right now. Try again in a minute."

/** Every passcode attempt, counted per client address in this process (one Cloud Run instance). */
const attempts = rateLimiter({ ...JUDGE_ATTEMPTS, maxKeys: 10_000 })

/** A form field as text, else empty: a file or a missing field is no passcode. */
const field = z.string().max(200).catch('')

async function passcodeThrough(form: FormData): Promise<ActionResult> {
  return judgeAttempt({
    env: process.env,
    passcode: field.parse(form.get('passcode')),
    address: clientAddress(await headers()),
    hit: attempts,
  })
}

/** Signs in, sets the session cookie and redirects; a failure is logged and said. */
async function signInAndGo(log: string, run: () => Promise<JudgeSignIn>): Promise<ActionResult> {
  let signedIn: JudgeSignIn
  try {
    signedIn = await run()
  } catch (err) {
    console.error(`[${log}]`, err instanceof Error && err.cause ? err.cause : err)
    return { ok: false, error: UNAVAILABLE }
  }
  const { name, value, options } = signedIn.cookie
  ;(await cookies()).set(name, value, options)
  redirect(signedIn.to)
}

/** The admin sign-in page's judge access: the shared admin judge, on to the Board. */
export async function judgeAdminSignInAction(
  _previous: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const admitted = await passcodeThrough(form)
  if (!admitted.ok) return admitted
  return signInAndGo('judge.adminSignIn', signInJudgeAdmin)
}

/** The story chosen: one of the stories, null to start from the beginning, else undefined. */
function storyOf(form: FormData): JudgeStory | null | undefined {
  const id = field.parse(form.get('story'))
  return id === FRESH_START ? null : judgeStoryById(id)
}

/**
 * The student sign-in page's judge access: a new student with the story chosen, on to her
 * roadmap, or a new student from the beginning, on to the welcome.
 */
export async function judgeStudentSignInAction(
  _previous: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const admitted = await passcodeThrough(form)
  if (!admitted.ok) return admitted
  const story = storyOf(form)
  if (story === undefined) return { ok: false, error: CHOOSE_STORY }
  return signInAndGo('judge.studentSignIn', () => signInJudgeStudent(story))
}
