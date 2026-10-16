import 'server-only'
import { and, asc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/shared/lib/db'
import { contentStep } from '@/shared/lib/db/schema'
import type { ActionResult } from '@/shared/types/action-result'
import type { StepProgress } from '../lib/running'
import { WORKFLOW_ERRORS } from '../lib/workflow'
import { afterResponse } from './after'

// The step lock: one content_step row per post and step. Taking it is one statement, so two
// clicks racing each other cannot both win; a lock not heard from for STEP_TIMEOUT_MS (a crashed
// run) is taken over. A long run keeps its lock by recording its progress, which beats. A refresh
// reads what is running, how far it is, and what last failed, from the same rows.

export const STEP_TIMEOUT_MS = 5 * 60_000

const DB_ERROR = 'Could not save. Please try again.'
// A constant, never input: the timeout as a Postgres interval.
const TIMEOUT = sql.raw(`interval '${STEP_TIMEOUT_MS} milliseconds'`)
/** When a run was last heard from: its last beat, or its start. */
const HEARD = sql`coalesce(${contentStep.beatAt}, ${contentStep.startedAt})`

const ProgressSchema = z.object({ done: z.number().int().min(0), total: z.number().int().min(0) })

/** What the work of a step gets: a way to record how far it is, which also keeps its lock. */
export type StepRun = {
  /** Records the progress and beats; false when the run no longer holds its lock (taken over or ended), so it stops. */
  progress(done: number, total: number): Promise<boolean>
}

/** A run that holds its step's lock: started_at as text identifies it. */
type Held = { postId: string; step: string; startedAt: string }

/** Takes the step's lock, or says why not: another run holds it, or the database failed. */
async function take(
  postId: string,
  step: string,
  version: number,
): Promise<{ ok: true; held: Held } | { ok: false; error: string }> {
  try {
    const [taken] = await db
      .insert(contentStep)
      .values({ postId, step, status: 'running', startedVersion: version, startedAt: sql`now()` })
      .onConflictDoUpdate({
        target: [contentStep.postId, contentStep.step],
        set: {
          status: 'running',
          startedAt: sql`now()`,
          startedVersion: version,
          finishedAt: null,
          error: null,
          progress: null,
          beatAt: null,
        },
        setWhere: sql`${contentStep.status} <> 'running' or ${HEARD} < now() - ${TIMEOUT}`,
      })
      .returning({ startedAt: sql<string>`${contentStep.startedAt}::text` })
    if (!taken) return { ok: false, error: WORKFLOW_ERRORS.running }
    return { ok: true, held: { postId, step, startedAt: taken.startedAt } }
  } catch (err) {
    console.error('[content.steps.lock]', err)
    return { ok: false, error: DB_ERROR }
  }
}

/** The held run's own row while it runs: a run whose lock was taken over leaves the new one alone. */
const heldRow = (held: Held) =>
  and(
    eq(contentStep.postId, held.postId),
    eq(contentStep.step, held.step),
    eq(contentStep.status, 'running'),
    sql`${contentStep.startedAt}::text = ${held.startedAt}`,
  )

/** The handle the held run's work records its progress with. */
function runOf(held: Held): StepRun {
  return {
    async progress(done, total) {
      const rows = await db
        .update(contentStep)
        .set({ progress: { done, total }, beatAt: sql`now()` })
        .where(heldRow(held))
        .returning({ step: contentStep.step })
      return rows.length > 0
    },
  }
}

/** Runs the work, never throwing, then marks the run done or failed with its message. */
async function finish<T>(
  held: Held,
  work: (run: StepRun) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  let result: ActionResult<T>
  try {
    result = await work(runOf(held))
  } catch (err) {
    console.error(`[content.steps.${held.step}]`, err)
    result = { ok: false, error: DB_ERROR }
  }

  try {
    await db
      .update(contentStep)
      .set({
        status: result.ok ? 'done' : 'failed',
        finishedAt: sql`now()`,
        error: result.ok ? null : result.error,
      })
      .where(heldRow(held))
  } catch (err) {
    // The work is done; a lock left running expires after STEP_TIMEOUT_MS.
    console.error('[content.steps.unlock]', err)
  }
  return result
}

/**
 * Runs `work` for one post step under a lock: refused with WORKFLOW_ERRORS.running while the same
 * step on the same post is running and was heard from within STEP_TIMEOUT_MS. Marks it done or
 * failed after. Never throws.
 */
export async function runStep<T>(
  postId: string,
  step: string,
  version: number,
  work: (run: StepRun) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const lock = await take(postId, step, version)
  return lock.ok ? finish(lock.held, work) : lock
}

/**
 * Takes the step's lock now and runs `work` after the response is sent (./after.ts), so the
 * request returns at once while the page, polling, shows the step running and then its result
 * or its failure. False when the step is already running (that run goes on) or the lock failed.
 */
export async function runStepAfter<T>(
  postId: string,
  step: string,
  version: number,
  work: (run: StepRun) => Promise<ActionResult<T>>,
): Promise<boolean> {
  const lock = await take(postId, step, version)
  if (!lock.ok) return false
  try {
    afterResponse(() => finish(lock.held, work))
    return true
  } catch (err) {
    // Not inside a request: the run is recorded as failed rather than left holding the lock.
    console.error(`[content.steps.${step}] could not schedule`, err)
    await finish(lock.held, async () => ({ ok: false, error: DB_ERROR }))
    return false
  }
}

/** The steps whose last run on a post failed, by name: the page says so beside the step. */
export async function failedSteps(postId: string): Promise<string[]> {
  const rows = await db
    .select({ step: contentStep.step })
    .from(contentStep)
    .where(and(eq(contentStep.postId, postId), eq(contentStep.status, 'failed')))
    .orderBy(asc(contentStep.step))
  return rows.map((r) => r.step)
}

/**
 * The steps running on a post now, by name, and how far each that records its progress is: one
 * query over the post's rows (the primary key leads with post_id).
 */
export async function runningNow(
  postId: string,
): Promise<{ running: string[]; progress: Record<string, StepProgress> }> {
  const rows = await db
    .select({ step: contentStep.step, progress: contentStep.progress })
    .from(contentStep)
    .where(
      and(
        eq(contentStep.postId, postId),
        eq(contentStep.status, 'running'),
        sql`${HEARD} >= now() - ${TIMEOUT}`,
      ),
    )
    .orderBy(asc(contentStep.step))
  const progress: Record<string, StepProgress> = {}
  for (const row of rows) {
    const parsed = ProgressSchema.safeParse(row.progress)
    if (parsed.success) progress[row.step] = parsed.data
  }
  return { running: rows.map((r) => r.step), progress }
}

/** The steps running on a post now, by name. */
export async function runningSteps(postId: string): Promise<string[]> {
  return (await runningNow(postId)).running
}
