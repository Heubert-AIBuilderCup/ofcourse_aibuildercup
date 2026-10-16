'use client'

import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import type { StackRow, Tile } from '../model/road-data'
import { MockTag } from './MockTag'
import { PanelHead } from './PanelHead'
import styles from './road-map.module.css'

const FILTERS = ['All', 'Match well', 'Not yet reachable'] as const
type Filter = (typeof FILTERS)[number]

const shows = (filter: Filter, row: StackRow) => filter === 'All' || row.tag === filter

const ROW_ACTION = 'h-10 px-3.5 font-sans font-medium'

/**
 * A stack's list (`open=list`): its title and Close, the filters as a button group, then a row per
 * course with its actions. "Put on my board" places a row's course beside her road; a row whose
 * course has no tile this round, and More, do nothing yet. A course already on the board is left
 * out. A row whose course is in a field next to the one she picked says so, with that field defined.
 */
export function StackList({
  stack,
  rows,
  onBoard,
  onClose,
  onPut,
}: {
  stack: Tile
  rows: StackRow[]
  /** The tiles on the board now. */
  onBoard: string[]
  onClose: () => void
  onPut: (tileId: string) => void
}) {
  const [filter, setFilter] = useState<Filter>('All')
  const listed = rows.filter((r) => !(r.tileId && onBoard.includes(r.tileId)) && shows(filter, r))

  return (
    <section aria-label={stack.name} className="flex flex-col gap-4">
      <PanelHead kicker="Stack · Course" title={stack.name} onClose={onClose} />
      <p className="-mt-2 mb-0 text-muted-foreground">{stack.sub}</p>
      <fieldset aria-label="Filter" className="m-0 flex min-w-0 flex-wrap gap-1.5 border-0 p-0">
        {FILTERS.map((f) => (
          <Button
            key={f}
            type="button"
            variant="square"
            aria-pressed={f === filter}
            onClick={() => setFilter(f)}
            className="h-11 px-3 font-sans font-normal aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-brand-foreground aria-pressed:hover:bg-brand-hover"
          >
            {f}
          </Button>
        ))}
      </fieldset>
      <ul className="m-0 flex list-none flex-col p-0">
        {listed.map(({ tileId, ...row }) => (
          <li
            key={row.name}
            className={cn(
              'grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 border-t py-3.5',
              row.blocked && styles.hatch,
            )}
          >
            <span className="flex flex-col gap-0.5">
              <span className="font-heading text-lead font-semibold">{row.name}</span>
              <span className="text-sm text-muted-foreground">{row.sub}</span>
              {row.related ? (
                <span className="mt-1 text-caption text-muted-foreground">
                  <span className="mr-1.5 border border-accent-700 px-2 py-0.5 text-accent-800">
                    Related to what you picked
                  </span>
                  {row.related.field}: {row.related.definition}
                </span>
              ) : null}
            </span>
            {row.tag ? (
              <span
                className={cn(
                  'self-start border px-2 py-0.5 text-caption whitespace-nowrap',
                  row.blocked
                    ? 'border-dashed border-neutral-600 text-muted-foreground'
                    : 'border-accent-700 text-accent-800',
                )}
              >
                {row.tag}
              </span>
            ) : null}
            {row.blocked ? null : (
              <span className="col-span-2 flex gap-2">
                <Button
                  type="button"
                  variant="square"
                  className={ROW_ACTION}
                  onClick={tileId ? () => onPut(tileId) : undefined}
                >
                  Put on my board
                </Button>
                <Button type="button" variant="square" className={ROW_ACTION}>
                  More
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="m-0 flex items-center gap-1 text-caption text-muted-foreground">
        Source: OfCourse preview data ·
        <MockTag />
      </p>
    </section>
  )
}
