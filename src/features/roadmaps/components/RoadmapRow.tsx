'use client'

import Link from 'next/link'
import { type ReactNode, useId } from 'react'
import motion from '@/shared/components/motion.module.css'
import { Button } from '@/shared/components/ui/button'
import { roadmapPath } from '@/shared/lib/student-paths'
import { cn } from '@/shared/lib/utils'
import type { RoadmapSummary } from '../model/roadmap'
import { CardMenu, type RowActions } from './CardMenu'
import { RoadGlyph } from './RoadGlyph'

/** What a row or a table row needs beside its roadmap. */
export type RowProps = {
  roadmap: RoadmapSummary
  /** The one she opened last, out of the archive: its glyph and edge in the accent. */
  on: boolean
  /** More than one roadmap out of the archive: Archive and Delete are offered. */
  canPutAway: boolean
  actions: RowActions
}

const OPEN_FOCUS =
  'text-left text-inherit no-underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary'

/**
 * A row's main action, around what it shows: a link to its board, named by its name; archived, a
 * button that restores it ("Restore <name>"). `describedBy` names what reads as its description.
 */
export function RowOpen({
  roadmap: r,
  restore,
  describedBy,
  className,
  children,
}: {
  roadmap: RoadmapSummary
  restore: RowActions['restore']
  describedBy: string
  className: string
  children: ReactNode
}) {
  if (r.archived) {
    return (
      <Button
        type="button"
        variant="ghost"
        aria-label={`Restore ${r.name}`}
        aria-describedby={describedBy}
        onClick={(event) => restore(r.id, event.currentTarget)}
        className={cn(
          'h-auto justify-start rounded-none p-0 font-sans text-base font-normal whitespace-normal hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0',
          OPEN_FOCUS,
          className,
        )}
      >
        {children}
      </Button>
    )
  }
  return (
    <Link
      href={roadmapPath(r.id)}
      aria-label={r.name}
      aria-describedby={describedBy}
      className={cn(OPEN_FOCUS, className)}
    >
      {children}
    </Link>
  )
}

/** "New", on a roadmap she has never opened (never on an archived one). */
export function NewTag({ id }: { id?: string }) {
  return (
    <span
      id={id}
      className="self-start bg-brand px-2 py-0.5 font-heading text-overline font-semibold text-brand-foreground uppercase"
    >
      New
    </span>
  )
}

const CHIP = 'border border-dashed border-foreground/45 px-2 py-0.5 text-caption leading-snug'

/**
 * A dashed chip per answer that differs from the roadmap it was copied from; none, nothing. A list,
 * except inside an archived row's restore button, which holds phrasing content only (spans).
 */
export function DiffChips({
  diffs,
  id,
  inButton,
}: {
  diffs: string[]
  id: string
  inButton: boolean
}) {
  if (diffs.length === 0) return null
  const Chips = inButton ? 'span' : 'ul'
  const Chip = inButton ? 'span' : 'li'
  return (
    <Chips
      id={id}
      aria-label={inButton ? undefined : 'Different from the roadmap it was copied from'}
      className="m-0 mt-1 flex list-none flex-wrap gap-1.5 p-0"
    >
      {diffs.map((diff) => (
        <Chip key={diff} className={CHIP}>
          {diff}
        </Chip>
      ))}
    </Chips>
  )
}

/** The ids that describe a row's link or button, in reading order; a part not shown is left out. */
export const describedBy = (parts: (string | false)[]) => parts.filter(Boolean).join(' ')

/**
 * One roadmap as a compact row (the cards view): the road glyph, the New tag, the name, its course
 * line, Point B, the chips and where it came from with when it was opened; all of it opens its
 * board (or, archived, restores it). The "…" menu sits at its right. The one opened last is marked
 * (`data-last-opened`, the accent edge); an archived one is faded.
 */
export function RoadmapRow({ roadmap: r, on, canPutAway, actions }: RowProps) {
  const id = useId()
  const isNew = r.isNew && !r.archived
  const described = describedBy([
    isNew && `${id}-new`,
    `${id}-line`,
    `${id}-pb`,
    r.diffs.length > 0 && `${id}-chips`,
    `${id}-meta`,
  ])

  return (
    <li
      data-last-opened={on || undefined}
      className={cn(
        'group/row relative flex items-start border border-foreground/18 bg-background transition-colors duration-200 hover:border-foreground/45 has-[[aria-expanded=true]]:z-10',
        (on || isNew) && 'border-primary hover:border-primary',
        on && 'bg-accent-100/55',
        isNew && motion.rise,
        r.archived && 'opacity-75',
      )}
    >
      {on ? (
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.75 bg-primary" />
      ) : null}
      <RowOpen
        roadmap={r}
        restore={actions.restore}
        describedBy={described}
        className="flex min-w-0 flex-1 items-start gap-3 py-4.5 pl-4"
      >
        <RoadGlyph on={on} />
        <span className="flex min-w-0 flex-col gap-1">
          {isNew ? <NewTag id={`${id}-new`} /> : null}
          <span className="font-heading text-h4 font-semibold">{r.name}</span>
          <span id={`${id}-line`} className="text-caption text-muted-foreground">
            {r.line}
          </span>
          <span id={`${id}-pb`} className="text-caption">
            <span className="mr-1 font-heading text-overline font-medium text-muted-foreground uppercase">
              Point B
            </span>
            {r.pointB}
          </span>
          <DiffChips diffs={r.diffs} id={`${id}-chips`} inButton={r.archived} />
          <span id={`${id}-meta`} className="text-caption text-muted-foreground">
            {r.from} · {r.openedLabel}
          </span>
        </span>
      </RowOpen>
      <div className="flex-none pt-2 pr-1.5">
        <CardMenu roadmap={r} canPutAway={canPutAway} actions={actions} />
      </div>
    </li>
  )
}
