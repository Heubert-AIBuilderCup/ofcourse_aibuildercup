import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, count, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/shared/lib/db'
import { aiCall } from '@/shared/lib/db/schema'
import type { CallLog } from './client'

/** The rows a cap counts: real calls a model answered, not a cache hit or a busy model's refusal. */
const counts = and(eq(aiCall.cached, false), eq(aiCall.refused, false))

/** The ai_call table: one row per model attempt, and the daily caps counted from it. */
export const dbCallLog: CallLog = {
  /** Answered calls only: a cache hit or a refused call (429) costs nothing, so it does not count. */
  async countToday(tier, day) {
    const [row] = await db
      .select({ n: count() })
      .from(aiCall)
      .where(and(eq(aiCall.day, day), eq(aiCall.tier, tier), counts))
    return row?.n ?? 0
  },

  async record(row) {
    await db.insert(aiCall).values({
      id: randomUUID(),
      day: new Date().toISOString().slice(0, 10),
      useCase: row.useCase,
      tier: row.tier,
      model: row.model,
      promptVersion: row.promptVersion,
      ok: row.ok,
      cached: row.cached,
      ms: row.ms,
      fallback: row.fallback,
      postId: row.postId,
      refused: row.refused ?? false,
    })
  },

  /**
   * Counts and inserts under a transaction lock on the cap (tier or use cases) and day, so two
   * calls racing for the last slot are counted one after the other: the first inserts its pending
   * row, the second sees it and is refused. Nothing is inserted for a call refused at the cap.
   */
  async reserve(row) {
    // The search cap counts its use cases, whatever their tier; every other cap counts its tier.
    const scope = row.useCases ? row.useCases.join(',') : row.tier
    const counted = row.useCases
      ? inArray(aiCall.useCase, [...row.useCases])
      : eq(aiCall.tier, row.tier)
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`ai_call:${scope}:${row.day}`}))`,
      )
      const [used] = await tx
        .select({ n: count() })
        .from(aiCall)
        .where(and(eq(aiCall.day, row.day), counted, counts))
      if ((used?.n ?? 0) >= row.cap) return null
      const id = randomUUID()
      await tx.insert(aiCall).values({
        id,
        day: row.day,
        useCase: row.useCase,
        tier: row.tier,
        model: row.model,
        promptVersion: row.promptVersion,
        ok: false,
        cached: false,
        ms: 0,
        fallback: row.fallback ?? null,
        postId: row.postId,
      })
      return id
    })
  },

  /** A row settled as refused (a 429) stays in the log and frees its slot. */
  async settle(id, outcome) {
    await db
      .update(aiCall)
      .set({ ok: outcome.ok, ms: outcome.ms, refused: outcome.refused })
      .where(eq(aiCall.id, id))
  },
}
