import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, count, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/shared/lib/db'
import { aiCall } from '@/shared/lib/db/schema'
import type { CallLog } from './client'

/** The ai_call table: one row per model attempt, and the daily caps counted from it. */
export const dbCallLog: CallLog = {
  /** Real calls only: a cache hit costs nothing, so it does not count against a cap. */
  async countToday(tier, day) {
    const [row] = await db
      .select({ n: count() })
      .from(aiCall)
      .where(and(eq(aiCall.day, day), eq(aiCall.tier, tier), eq(aiCall.cached, false)))
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
    })
  },

  /**
   * Counts and inserts under a transaction lock on the cap (tier or use cases) and day, so two
   * calls racing for the last slot are counted one after the other: the first inserts its pending
   * row, the second sees it and is refused. Nothing is inserted for a refused call.
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
        .where(and(eq(aiCall.day, row.day), counted, eq(aiCall.cached, false)))
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

  async settle(id, outcome) {
    await db.update(aiCall).set({ ok: outcome.ok, ms: outcome.ms }).where(eq(aiCall.id, id))
  },
}
