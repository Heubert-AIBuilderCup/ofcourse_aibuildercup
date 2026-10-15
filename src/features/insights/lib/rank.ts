// The Comic gaps tab's ranking (RC13, RC14, RC18): each path with how many times students were shown
// it, how it was shown, its catalogue lines and its comic's status. Until real views add up to a
// demo's worth, a path with no real count shows an example count, marked mock, so the tab is never
// a column of zeros.

import type { Path } from '@/features/content/lib/path-facts'
import { COURSES, type Dimension } from '@/features/engine'
import type { FutureId } from '@/shared/types/student'

export type ComicStatus = 'in_progress' | 'live'

/**
 * How a path was shown to students over a window (RC18): its showings, how many as each future,
 * each strength and cost as a whole percentage of the showings as a future, and how often it was out of
 * reach with the average AUD k over budget.
 */
export type ShowingStats = {
  showings: number
  byFuture: Record<FutureId, number>
  strongOn: Record<Dimension, number>
  costsOn: Record<Dimension, number>
  outOfReach: { count: number; avgOverK: number }
}

/** A catalogue line as students see it on the path's future. */
export type PathLine = { dim: (typeof LINE_DIMS)[number]; text: string }

export type InsightRow = {
  path: Path
  count: number
  mock: boolean
  status: 'none' | ComicStatus
  /** How it was shown (RC18); null when never shown, and always for a mock-counted path. */
  showing: ShowingStats | null
  lines: PathLine[]
}

const LINE_DIMS = ['time', 'work', 'pr', 'career'] as const

/** The path's lines from the catalogue, in the order the futures show them; none off the catalogue. */
function linesOf(id: string): PathLine[] {
  const course = COURSES.find((c) => c.id === id)
  return course ? LINE_DIMS.map((dim) => ({ dim, text: course.lines[dim].text })) : []
}

/**
 * Paths by count, most shown first, then by label; mock counts fill in while real ones are few,
 * and a mock-counted path never carries a showing, so no strength or cost is invented for it.
 */
export function rankPaths(
  paths: readonly Path[],
  real: Map<string, number>,
  comics: Map<string, ComicStatus>,
  showings: Map<string, ShowingStats>,
  mock: Record<string, number>,
  opts = { mockBelow: 20 },
): InsightRow[] {
  let total = 0
  for (const views of real.values()) total += views
  const fill = total < opts.mockBelow
  return paths
    .map((path): InsightRow => {
      const views = real.get(path.id)
      const isMock = views === undefined && fill
      return {
        path,
        count: isMock ? (mock[path.id] ?? 0) : (views ?? 0),
        mock: isMock,
        status: comics.get(path.id) ?? 'none',
        showing: isMock ? null : (showings.get(path.id) ?? null),
        lines: linesOf(path.id),
      }
    })
    .sort((a, b) => b.count - a.count || a.path.label.localeCompare(b.path.label))
}
