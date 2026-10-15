'use client'

import Link from 'next/link'
import { useId } from 'react'
import motion from '@/shared/components/motion.module.css'
import { roadmapPath } from '@/shared/lib/student-paths'
import { cn } from '@/shared/lib/utils'
import type { RoadmapSummary } from '../model/roadmap'
import { CardMenu } from './CardMenu'
import { RoadmapThumb } from './RoadmapThumb'

/**
 * One roadmap on the list. The drawing, the name, its line and its Point B are one link to its
 * board (named by its name, the rest read as its description); under it where it came from, a
 * dashed chip per answer that differs from its source, when it was opened, and the "…" menu. A
 * roadmap never opened is New: a 2px accent border and the tag.
 */
export function RoadmapCard({
  roadmap: r,
  canDelete,
  onRename,
  onDelete,
}: {
  roadmap: RoadmapSummary
  canDelete: boolean
  onRename: (opener: HTMLElement | null) => void
  onDelete: (opener: HTMLElement | null) => void
}) {
  const id = useId()
  const described = [r.isNew && `${id}-new`, `${id}-line`, `${id}-pb`].filter(Boolean).join(' ')

  return (
    <li
      className={cn(
        'relative flex flex-col border border-foreground/22 bg-background transition-colors duration-200 hover:border-foreground has-[[aria-expanded=true]]:z-10',
        r.isNew && ['-m-px border-2 border-primary hover:border-primary', motion.rise],
      )}
    >
      <Link
        href={roadmapPath(r.id)}
        aria-label={r.name}
        aria-describedby={described}
        className="flex flex-col text-inherit no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <RoadmapThumb here={r.thumb.here} alt={r.thumb.alt} place={r.place} />
        <span className="flex flex-col gap-1.5 px-5 pt-4.5">
          {r.isNew ? (
            <span
              id={`${id}-new`}
              className="self-start bg-brand px-2 py-0.5 font-heading text-overline font-semibold text-brand-foreground uppercase"
            >
              New
            </span>
          ) : null}
          <span className="font-heading text-h3 font-semibold">{r.name}</span>
          <span id={`${id}-line`} className="text-muted-foreground">
            {r.line}
          </span>
          <span id={`${id}-pb`}>
            <span className="mr-1.5 font-heading text-overline font-medium text-muted-foreground uppercase">
              Point B
            </span>
            {r.pointB}
          </span>
        </span>
      </Link>

      <div className="flex flex-col gap-2 px-5 pt-3.5">
        <p className="m-0 text-caption text-muted-foreground">{r.from}</p>
        {r.diffs.length > 0 ? (
          <ul
            aria-label="Different from the roadmap it was copied from"
            className="m-0 flex list-none flex-wrap gap-1.5 p-0"
          >
            {r.diffs.map((diff) => (
              <li
                key={diff}
                className="border border-dashed border-foreground/45 px-2 py-1 text-caption leading-snug"
              >
                {diff}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 pt-3 pr-2 pb-2 pl-5">
        <span className="text-caption text-muted-foreground">{r.openedLabel}</span>
        <CardMenu
          id={r.id}
          name={r.name}
          canDelete={canDelete}
          onRename={onRename}
          onDelete={onDelete}
        />
      </div>
    </li>
  )
}
