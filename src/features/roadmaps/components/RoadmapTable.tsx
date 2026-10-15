'use client'

import { useId } from 'react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import type { RoadmapOrder, RoadmapSummary } from '../model/roadmap'
import { CardMenu, type RowActions } from './CardMenu'
import { RoadGlyph } from './RoadGlyph'
import { DiffChips, describedBy, NewTag, RowOpen, type RowProps } from './RoadmapRow'
import styles from './roadmaps.module.css'

const HEAD =
  'border-b border-foreground/25 px-4 py-3 text-left font-heading text-overline font-medium whitespace-nowrap text-muted-foreground uppercase'

/**
 * Her roadmaps as a table: Roadmap (the glyph, the name, where it came from, its chips), Course ·
 * city, Progress, Next, Point B, Last opened and the "…" menu. The Roadmap and Last opened headers
 * sort (`aria-sort` says which is on: Roadmap ascending, A to Z; Last opened descending, the most
 * recent first). On a phone each row stacks, its cells labelled by their column's name (`data-k`,
 * roadmaps.module.css).
 */
export function RoadmapTable({
  caption,
  roadmaps,
  lastOpenedId,
  canPutAway,
  actions,
  sort,
  onSort,
}: {
  caption: string
  roadmaps: RoadmapSummary[]
  lastOpenedId: string | null
  canPutAway: boolean
  actions: RowActions
  sort: RoadmapOrder
  onSort: (by: RoadmapOrder) => void
}) {
  // A header that sorts the table by its column.
  const header = (by: RoadmapOrder, label: string) => {
    const on = sort === by
    return (
      <th
        scope="col"
        aria-sort={on ? (by === 'name' ? 'ascending' : 'descending') : 'none'}
        className={HEAD}
      >
        <Button
          type="button"
          variant="ghost"
          onClick={() => onSort(by)}
          className={cn(
            'h-11 -my-3 gap-1.5 rounded-none p-0 font-heading text-overline font-medium uppercase hover:bg-transparent hover:text-foreground',
            on ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {label}
          <span
            aria-hidden="true"
            className={cn(
              'size-1.75 -translate-y-0.5 rotate-45 border-r-2 border-b-2 border-current',
              !on && 'opacity-0',
            )}
          />
        </Button>
      </th>
    )
  }

  return (
    <div
      className={cn(
        styles.tableWrap,
        'overflow-x-auto border border-foreground/20 bg-background @5xl:overflow-visible',
      )}
    >
      <table className={cn(styles.table, 'w-full border-collapse')}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {header('name', 'Roadmap')}
            <th scope="col" className={HEAD}>
              Course · city
            </th>
            <th scope="col" className={HEAD}>
              Progress
            </th>
            <th scope="col" className={HEAD}>
              Next
            </th>
            <th scope="col" className={HEAD}>
              Point B
            </th>
            {header('opened', 'Last opened')}
            <th scope="col" className={HEAD}>
              <span className="sr-only">More</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {roadmaps.map((r) => (
            <TableRow
              key={r.id}
              roadmap={r}
              on={r.id === lastOpenedId}
              canPutAway={canPutAway}
              actions={actions}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

const CELL = 'border-b border-border px-4 py-3.5 text-left align-middle font-normal'

function TableRow({ roadmap: r, on, canPutAway, actions }: RowProps) {
  const id = useId()
  const isNew = r.isNew && !r.archived
  const { walked, steps } = r.progress

  return (
    <tr
      data-last-opened={on || undefined}
      className={cn(
        'group/row relative transition-colors duration-150 last:*:border-b-0 hover:bg-accent-100/60 has-[[aria-expanded=true]]:z-10',
        r.archived && 'opacity-75',
      )}
    >
      <th scope="row" className={cn(CELL, 'min-w-64')}>
        <RowOpen
          roadmap={r}
          restore={actions.restore}
          describedBy={describedBy([
            isNew && `${id}-new`,
            `${id}-from`,
            r.diffs.length > 0 && `${id}-chips`,
          ])}
          className="flex items-start gap-3"
        >
          <RoadGlyph on={on} />
          <span className="flex min-w-0 flex-col gap-0.5">
            {isNew ? <NewTag id={`${id}-new`} /> : null}
            <span className="font-heading text-h4 font-semibold group-hover/row:underline">
              {r.name}
            </span>
            <span id={`${id}-from`} className="text-caption text-muted-foreground">
              {r.from}
            </span>
            <DiffChips diffs={r.diffs} id={`${id}-chips`} inButton={r.archived} />
          </span>
        </RowOpen>
      </th>
      <td data-k="Course · city" className={CELL}>
        {r.line}
      </td>
      <td data-k="Progress" className={CELL}>
        <span className="flex min-w-34 flex-col gap-1.25">
          <span aria-hidden="true" className="relative h-1.5 overflow-hidden bg-foreground/12">
            <span
              className="absolute inset-y-0 left-0 bg-primary"
              style={{ width: `${steps > 0 ? Math.round((walked / steps) * 100) : 0}%` }}
            />
          </span>
          <span className="text-caption text-muted-foreground">
            {walked} of {steps} steps walked
          </span>
        </span>
      </td>
      <td data-k="Next" className={CELL}>
        {r.next}
      </td>
      <td data-k="Point B" className={CELL}>
        {r.pointB}
      </td>
      <td data-k="Last opened" className={CELL}>
        {r.openedLabel}
      </td>
      <td className={cn(styles.more, CELL, 'w-14 pr-2')}>
        <CardMenu roadmap={r} canPutAway={canPutAway} actions={actions} />
      </td>
    </tr>
  )
}
