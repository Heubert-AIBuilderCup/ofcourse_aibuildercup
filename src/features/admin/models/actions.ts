'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { TIERS, type Tier, type UseCase } from '@/features/content/ai/config'
import { allowedTiers, isKnownModel } from '@/features/content/ai/models'
import { resetAll, saveTierModel, saveUseCaseTier } from '@/features/content/ai/settings'
import { ACCESS_ERRORS, canManageModels, canUseAdmin } from '@/shared/lib/auth/access'
import { getSession } from '@/shared/lib/auth/session'
import type { ActionResult } from '@/shared/types/action-result'
import {
  OFF_TIER,
  type StudentCallRow,
  type TestResult,
  testStudentCalls,
  testUseCase,
} from './test-call'
import { USE_CASES } from './use-cases'

// The Models page's actions (criteria 91–97). Each reads the account from the session, never the
// request: signed out it asks to sign in again, anyone but an admin or a superadmin is refused,
// and an admin who is not a superadmin is refused every test, change and reset (canManageModels).
// The browser's input is checked here: the settings writes trust their caller.

const SIGN_IN = 'Please sign in again.'
const UNKNOWN_USE_CASE = 'Unknown use case.'
const UNKNOWN_MODEL = 'Choose a model from the list for this tier.'
const FAILED = 'That did not work. Please try again.'

const useCaseSchema = z.enum(USE_CASES as [UseCase, ...UseCase[]])
const tierSchema = z.enum(TIERS)
const modelSchema = z.string().max(200)

/** The use case a tier's new model is tried on before it is saved: an admin one, never a student's. */
const TIER_PROBE: Record<Tier, UseCase> = {
  lite: 'extract',
  flash: 'extract',
  pro: 'extract',
  image: 'art',
}

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

/** Runs `run` as the signed-in superadmin; refuses anyone else; never throws. */
async function asSuperadmin<T extends object>(
  name: string,
  run: (userId: string) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    const session = await getSession()
    if (!session) return fail(SIGN_IN)
    const role = session.user.role
    if (!canUseAdmin(role) || !canManageModels(role)) return fail(ACCESS_ERRORS.notAuthorised)
    return await run(session.user.id)
  } catch (err) {
    console.error(`[admin.models.${name}]`, err)
    return fail(FAILED)
  }
}

const changed = () => revalidatePath('/admin/models')

/** One live call of a use case on its prompt example, the cache off (criterion 93). */
export async function testAction(useCase: unknown): Promise<ActionResult<{ result: TestResult }>> {
  return asSuperadmin('test', async () => {
    const u = useCaseSchema.safeParse(useCase)
    if (!u.success) return fail(UNKNOWN_USE_CASE)
    return { ok: true, result: await testUseCase(u.data) }
  })
}

/** The real-Gemini check's cases, once each, one row each (criterion 93). */
export async function testStudentCallsAction(): Promise<ActionResult<{ rows: StudentCallRow[] }>> {
  return asSuperadmin('testStudentCalls', async () => ({
    ok: true,
    rows: await testStudentCalls(),
  }))
}

/**
 * A tier's model from now: a known model for that tier only, saved only after one test call on it
 * passes (criterion 94).
 */
export async function saveTierModelAction(
  tier: unknown,
  model: unknown,
): Promise<ActionResult<{ result: TestResult }>> {
  return asSuperadmin('saveTierModel', async (userId) => {
    const t = tierSchema.safeParse(tier)
    const m = modelSchema.safeParse(model)
    if (!t.success || !m.success || !isKnownModel(m.data, t.data)) return fail(UNKNOWN_MODEL)
    const result = await testUseCase(TIER_PROBE[t.data], { tier: t.data, model: m.data })
    if (!result.ok) {
      return fail(`Not saved: the test on ${m.data} failed. ${result.error ?? ''}`.trim())
    }
    await saveTierModel(userId, t.data, m.data)
    changed()
    return { ok: true, result }
  })
}

/** A use case's tier from now: only a tier that use case allows (criterion 95). */
export async function saveUseCaseTierAction(
  useCase: unknown,
  tier: unknown,
): Promise<ActionResult> {
  return asSuperadmin('saveUseCaseTier', async (userId) => {
    const u = useCaseSchema.safeParse(useCase)
    if (!u.success) return fail(UNKNOWN_USE_CASE)
    const t = tierSchema.safeParse(tier)
    if (!t.success || !allowedTiers(u.data).includes(t.data)) return fail(OFF_TIER)
    await saveUseCaseTier(userId, u.data, t.data)
    changed()
    return { ok: true }
  })
}

/** Clears every choice, so every call runs on the environment's models again (criterion 97). */
export async function resetAction(): Promise<ActionResult> {
  return asSuperadmin('reset', async (userId) => {
    await resetAll(userId)
    changed()
    return { ok: true }
  })
}
