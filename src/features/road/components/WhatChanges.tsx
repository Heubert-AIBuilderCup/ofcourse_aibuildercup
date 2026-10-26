import Link from 'next/link'
import type { CardDetails } from '@/features/roads/client'
import { buttonVariants } from '@/shared/components/ui/button'
import { newRoadmapPath } from '@/shared/lib/student-paths'
import { cn } from '@/shared/lib/utils'
import { MockTag } from './MockTag'

/** The New roadmap draft from this roadmap, with a course pinned. */
export const pinnedDraftPath = (roadmapId: string, courseId: string): string =>
  `${newRoadmapPath(roadmapId)}&pin=${encodeURIComponent(courseId)}`

/**
 * "What changes" (criteria 26 and 27): her road beside an alternative, row by row. Stacked rows,
 * not a table, so a long line (the work rights) wraps whole in a narrow column: each row its
 * label, then "Now" and "If you switch"; a row that changes says so in a tag, one that does not
 * is muted. With `pin` (a course a new roadmap can be built around), "Start a new roadmap from
 * it" opens the New roadmap draft from this roadmap with that course pinned. It ends on the source
 * line and mock tag every card section carries, as its fees and living costs are preview data.
 */
export function WhatChanges({ rows, pin, roadmapId }: NonNullable<CardDetails['compare']>) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 font-sans text-overline font-normal text-muted-foreground uppercase">
        What changes
      </h2>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((row) => (
          <li
            key={row.key}
            className={cn('flex flex-col gap-0.5', !row.changed && 'text-muted-foreground')}
          >
            <span className="flex items-center gap-2">
              <span className="text-overline text-muted-foreground uppercase">{row.label}</span>
              {row.changed ? (
                <span className="border border-accent-700 px-2 py-0.5 text-caption text-accent-800">
                  Changes
                </span>
              ) : null}
            </span>
            <span>
              <span className="text-muted-foreground">Now:</span> {row.current}
            </span>
            <span>
              <span className="text-muted-foreground">If you switch:</span> {row.alternative}
            </span>
          </li>
        ))}
      </ul>
      <p className="m-0 flex items-center gap-1 text-caption text-muted-foreground">
        Source: OfCourse preview data ·
        <MockTag />
      </p>
      {pin ? (
        <Link
          href={pinnedDraftPath(roadmapId, pin)}
          className={cn(buttonVariants({ variant: 'outline' }), 'self-start')}
        >
          Start a new roadmap from it
        </Link>
      ) : null}
    </section>
  )
}
