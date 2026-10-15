// Counting the paths students are shown on `/futures` (RC12): each known path once per student per
// UTC day, under a viewer key that changes daily and keeps no user id. How each path was shown
// (RC17) is recorded per draw under the same key. Counting must never break
// the page it sits on, so recording catches every error, logs it and returns.

import 'server-only'
import { and, count, eq, gte, lt, lte, sql } from 'drizzle-orm'
import { pathById } from '@/features/content/lib/path-facts'
import { DIMENSIONS, type Dimension } from '@/features/engine'
import { db, schema } from '@/shared/lib/db'
import type { ShowingStats } from '../lib/rank'
import { viewerKey } from '../lib/viewer-key'

const DAY_MS = 24 * 60 * 60 * 1000
/** Rows older than this many days are deleted as new ones come in. */
const KEEP_DAYS = 31
/** Redraw showings recorded per viewer key a day; a redraw that would pass it is not recorded. */
const REDRAW_CAP = 30

/** The UTC day `back` days before `now`, as `YYYY-MM-DD`. */
const utcDay = (now: Date, back = 0) =>
  new Date(now.getTime() - back * DAY_MS).toISOString().slice(0, 10)

/** A futures result, read by its shape only, so nothing of the engine's is imported. */
export type ShownResult =
  | { kind: 'futures'; futures: readonly { courseId: string }[] }
  | { kind: 'sealed'; nearest: readonly { courseId: string }[] }

/**
 * What a showing keeps of a futures result (engine/futures.ts `FuturesResult`, by shape): each
 * future's id, path, strengths and costs, or each nearest route's path and how far over budget.
 */
export type ShowingResult =
  | {
      kind: 'futures'
      futures: readonly {
        id: 'cost' | 'staying' | 'career'
        courseId: string
        strongOn: readonly string[]
        costsOn: readonly string[]
      }[]
    }
  | { kind: 'sealed'; nearest: readonly { courseId: string; overByK: number }[] }

/** The distinct course ids a futures result shows: its futures, or its nearest routes when sealed. */
export function courseIdsShown(result: ShownResult): string[] {
  const shown = result.kind === 'futures' ? result.futures : result.nearest
  return [...new Set(shown.map((item) => item.courseId))]
}

let warnedNoSecret = false

/** The server's secret for viewer keys, or null with a warning the first time. */
function viewerSecret(): string | null {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret && !warnedNoSecret) {
    warnedNoSecret = true
    console.warn('[insights] BETTER_AUTH_SECRET is not set; no views are counted')
  }
  return secret || null
}

/** Counts each known path in `courseIds` once for this student today; never throws. */
export async function recordPathViews(
  userId: string,
  courseIds: readonly string[],
  now = new Date(),
): Promise<void> {
  const secret = viewerSecret()
  if (!secret) return
  try {
    const day = utcDay(now)
    const key = viewerKey(userId, day, secret)
    const known = [...new Set(courseIds)].filter((id) => pathById(id) !== null)
    await Promise.all([
      known.length > 0
        ? db
            .insert(schema.pathView)
            .values(known.map((courseId) => ({ day, courseId, viewerKey: key })))
            .onConflictDoNothing()
        : null,
      db.delete(schema.pathView).where(lt(schema.pathView.day, utcDay(now, KEEP_DAYS))),
    ])
  } catch (err) {
    console.error('[insights.recordPathViews]', err)
  }
}

/** How many redraw showings this viewer key has recorded on `day`. */
async function redrawsOn(day: string, key: string): Promise<number> {
  const [row] = await db
    .select({ rows: count() })
    .from(schema.pathShowing)
    .where(
      and(
        eq(schema.pathShowing.day, day),
        eq(schema.pathShowing.viewerKey, key),
        eq(schema.pathShowing.redraw, true),
      ),
    )
  return row?.rows ?? 0
}

/**
 * Records how each known path in `result` was shown to this student (RC17), one row per path,
 * and counts the day's views as recordPathViews does: a redraw adds rows, while a path already
 * counted today stays counted once. A redraw that would take the day's redraw showings past
 * REDRAW_CAP records nothing. Never throws.
 */
export async function recordFuturesShown(
  userId: string,
  result: ShowingResult,
  { redraw = false }: { redraw?: boolean } = {},
  now = new Date(),
): Promise<void> {
  const secret = viewerSecret()
  if (!secret) return
  const day = utcDay(now)
  const key = viewerKey(userId, day, secret)
  if (redraw) {
    try {
      const shownCount = result.kind === 'futures' ? result.futures.length : result.nearest.length
      if ((await redrawsOn(day, key)) + shownCount > REDRAW_CAP) return
    } catch (err) {
      console.error('[insights.recordFuturesShown]', err)
      return
    }
  }
  await recordPathViews(userId, courseIdsShown(result), now)
  try {
    const shown =
      result.kind === 'futures'
        ? result.futures.map((future) => ({
            courseId: future.courseId,
            futureId: future.id,
            strongOn: [...future.strongOn],
            costsOn: [...future.costsOn],
          }))
        : result.nearest.map((route) => ({
            courseId: route.courseId,
            outOfReach: true,
            overByK: Math.round(route.overByK),
          }))
    const known = shown.filter((row) => pathById(row.courseId) !== null)
    await Promise.all([
      known.length > 0
        ? db
            .insert(schema.pathShowing)
            .values(known.map((row) => ({ ...row, day, viewerKey: key, redraw })))
        : null,
      db.delete(schema.pathShowing).where(lt(schema.pathShowing.day, utcDay(now, KEEP_DAYS))),
    ])
  } catch (err) {
    console.error('[insights.recordFuturesShown]', err)
  }
}

/** How many times each path was shown over the last `days` UTC days, today included. */
export async function pathViewCounts(days = 30, now = new Date()): Promise<Map<string, number>> {
  const rows = await db
    .select({ courseId: schema.pathView.courseId, views: count() })
    .from(schema.pathView)
    .where(
      and(gte(schema.pathView.day, utcDay(now, days - 1)), lte(schema.pathView.day, utcDay(now))),
    )
    .groupBy(schema.pathView.courseId)
  return new Map(rows.map((row) => [row.courseId, row.views]))
}

/**
 * How each path was shown over the last `days` UTC days, today included (RC18), from the showings
 * of RC17. Counted in the database, so the rows read are one per path and one per path and
 * dimension seen; a path never shown is absent.
 */
export async function pathShowingStats(
  days = 30,
  now = new Date(),
): Promise<Map<string, ShowingStats>> {
  const t = schema.pathShowing
  const inWindow = and(gte(t.day, utcDay(now, days - 1)), lte(t.day, utcDay(now)))
  const filtered = (condition: ReturnType<typeof sql>) =>
    sql<number>`count(*) filter (where ${condition})`.mapWith(Number)
  const [paths, dimensions] = await Promise.all([
    db
      .select({
        courseId: t.courseId,
        showings: count(),
        asFuture: filtered(sql`${t.futureId} is not null`),
        cost: filtered(sql`${t.futureId} = 'cost'`),
        staying: filtered(sql`${t.futureId} = 'staying'`),
        career: filtered(sql`${t.futureId} = 'career'`),
        outOfReach: filtered(sql`${t.outOfReach}`),
        avgOverK:
          sql<number>`coalesce(avg(${t.overByK}) filter (where ${t.outOfReach}), 0)`.mapWith(
            Number,
          ),
      })
      .from(t)
      .where(inWindow)
      .groupBy(t.courseId),
    db.execute<{ course_id: string; side: 'strongOn' | 'costsOn'; dim: string; n: number }>(sql`
      select ${t.courseId} as course_id, 'strongOn' as side, dim, count(*)::int as n
        from ${t}, unnest(${t.strongOn}) as dim where ${inWindow} group by 1, 3
      union all
      select ${t.courseId}, 'costsOn', dim, count(*)::int
        from ${t}, unnest(${t.costsOn}) as dim where ${inWindow} group by 1, 3`),
  ])
  const none = () =>
    Object.fromEntries(DIMENSIONS.map((dim) => [dim, 0])) as Record<Dimension, number>
  const stats = new Map<string, ShowingStats>(
    paths.map((row) => [
      row.courseId,
      {
        showings: row.showings,
        byFuture: { cost: row.cost, staying: row.staying, career: row.career },
        strongOn: none(),
        costsOn: none(),
        outOfReach: { count: row.outOfReach, avgOverK: Math.round(row.avgOverK) },
      },
    ]),
  )
  // Out-of-reach showings carry no strengths or costs, so the shares are of the future showings.
  const asFuture = new Map(paths.map((row) => [row.courseId, row.asFuture]))
  const isDimension = (dim: string): dim is Dimension =>
    (DIMENSIONS as readonly string[]).includes(dim)
  for (const row of dimensions) {
    const path = stats.get(row.course_id)
    const total = asFuture.get(row.course_id)
    if (!path || !total || !isDimension(row.dim)) continue
    path[row.side][row.dim] = Math.round((Number(row.n) * 100) / total)
  }
  return stats
}
