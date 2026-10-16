import 'server-only'
import { and, count, eq, sql } from 'drizzle-orm'
import { db } from '@/shared/lib/db'
import { studentAsk } from '@/shared/lib/db/schema'
import { ASK_FAILED } from '../model/ask-words'

type AskOutcome = (typeof studentAsk.$inferInsert)['outcome']

/** The UTC day, as the ai_call log keeps it. */
const utcDay = () => new Date().toISOString().slice(0, 10)

/**
 * Her question's slot for today (UTC): its row's id, or null when she has asked `cap` today,
 * answered, refused or failed alike. Counted and inserted under a transaction lock on her and the
 * day (as ai/calls.ts reserves a model call), so questions sent at once take the slots one after
 * the other and never pass the cap. The row reads failed until settleAsk writes how it ended.
 */
export async function reserveAsk(
  input: { userId: string; roadmapId: string; tileId: string; question: string },
  cap: number,
): Promise<string | null> {
  const day = utcDay()
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`student_ask:${input.userId}:${day}`}))`,
    )
    const [used] = await tx
      .select({ n: count() })
      .from(studentAsk)
      .where(and(eq(studentAsk.userId, input.userId), eq(studentAsk.day, day)))
    if ((used?.n ?? 0) >= cap) return null
    const id = crypto.randomUUID()
    await tx.insert(studentAsk).values({ ...input, id, reply: ASK_FAILED, outcome: 'failed', day })
    return id
  })
}

/** What came back for a reserved question, and how it ended. */
export async function settleAsk(
  id: string,
  result: { reply: string; outcome: AskOutcome },
): Promise<void> {
  await db.update(studentAsk).set(result).where(eq(studentAsk.id, id))
}
