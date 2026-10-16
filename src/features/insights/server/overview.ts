import 'server-only'
import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { db, schema } from '@/shared/lib/db'

// The Insights overview's real figures: renders and AI calls over the last seven days, from the
// content records and the call log, and the live feed posts the performance table names. Each is
// counted in the database; the posts are bounded.

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_DAYS = 7

export type WeekFigures = { renders: number; calls: number; cached: number }

/**
 * Renders made and AI calls placed over the last seven days, and how many of those calls the cache
 * answered. The render count reads content_artifact by kind and time with no index of its own: a
 * scan, fine at the board's size.
 */
export async function weekFigures(now = new Date()): Promise<WeekFigures> {
  const since = new Date(now.getTime() - WEEK_DAYS * DAY_MS)
  const firstDay = new Date(now.getTime() - (WEEK_DAYS - 1) * DAY_MS).toISOString().slice(0, 10)
  const today = now.toISOString().slice(0, 10)
  const [[renders], [calls]] = await Promise.all([
    db
      .select({ n: count() })
      .from(schema.contentArtifact)
      .where(
        and(
          eq(schema.contentArtifact.kind, 'render'),
          gte(schema.contentArtifact.createdAt, since),
          lte(schema.contentArtifact.createdAt, now),
        ),
      ),
    db
      .select({
        n: count(),
        cached: sql<number>`count(*) filter (where ${schema.aiCall.cached})`.mapWith(Number),
      })
      .from(schema.aiCall)
      .where(and(gte(schema.aiCall.day, firstDay), lte(schema.aiCall.day, today))),
  ])
  return { renders: renders?.n ?? 0, calls: calls?.n ?? 0, cached: calls?.cached ?? 0 }
}

/** The live feed posts, latest first, at most `limit`: titles only. */
export async function liveFeedPosts(limit: number): Promise<{ id: string; title: string }[]> {
  return db
    .select({ id: schema.contentPost.id, title: schema.contentPost.title })
    .from(schema.contentPost)
    .where(and(eq(schema.contentPost.stage, 'live'), eq(schema.contentPost.kind, 'feed')))
    .orderBy(desc(schema.contentPost.updatedAt))
    .limit(limit)
}
