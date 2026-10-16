'use client'

import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import type { CardDetails, TilePost } from '@/features/roads/client'
import { Duck } from '@/shared/components/Duck'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { useTradePlaces } from '../hooks/useTradePlaces'
import { type PhoneRow, phoneRows, type RowState, rowFor } from '../model/phone-road'
import type { Card } from '../model/press'
import type { Road } from '../model/road-data'
import type { Scene } from '../model/scene'
import { LessonLink } from './LessonLink'
import { MockTag } from './MockTag'
import styles from './phone-road.module.css'
import { type CardAsk, type CardWhy, RoadCard } from './RoadCard'

const STATE_WORDS: Record<RowState, string> = {
  lit: 'visited',
  next: 'next',
  fog: 'unexplored',
  seen: 'looked at',
}

/** A tile to bring into view: a new object each time something changes. */
export type RoadFocus = { tileId: string }

type Props = {
  road: Road
  scene: Scene
  /** Where she is: the card her row shows. */
  card: Card
  /** The tile open in the sheet, if any: on arrival the road scrolls to its row. */
  tile: string | null
  /** What just changed (a swap, the lesson read, a course put on the board): scrolled into view. */
  changed: RoadFocus | null
  onOpen: (tileId: string) => void
  onClose: () => void
  onPrimary?: () => void
  onLesson: () => void
  /** Where her card asks why her tile is on her roadmap. */
  why?: CardWhy
  /** Where her card takes questions, when her tile is a city or course. */
  ask?: CardAsk
  /** What her card adds under its guide. */
  details?: CardDetails
  /** The posts and updates about her tile, for her card. */
  posts?: TilePost[]
}

/**
 * The phone's Road view: her road as an ordered list, top to bottom (phoneRows). Each step is a row
 * whose press opens its card in a sheet; where she is, the row is her card, the duck standing on the
 * line above it; the ways to PR close it. On arrival it scrolls to the open tile's row, else to where
 * she is; after a change, to what changed. A swap trades the two tiles' places along an arc.
 */
export function PhoneRoad({
  road,
  scene,
  card,
  tile,
  changed,
  onOpen,
  onClose,
  onPrimary,
  onLesson,
  why,
  ask,
  details,
  posts,
}: Props) {
  const rows = useMemo(() => phoneRows(road, scene), [road, scene])
  const listRef = useRef<HTMLOListElement>(null)
  useTradePlaces(listRef, scene)

  // What to bring into view: the arrival's tile, until something changes after it.
  const [arrival] = useState<RoadFocus>(() => ({ tileId: tile ?? scene.here }))
  const [changedAtArrival] = useState(changed)
  const target = changed && changed !== changedAtArrival ? changed : arrival
  const bring = useEffectEvent((tileId: string) => {
    const row = rowFor(rows, tileId) ?? rows.find((r) => r.kind === 'here')
    if (!row) return
    listRef.current
      ?.querySelector<HTMLElement>(`[data-row="${row.id}"]`)
      ?.scrollIntoView({ block: 'start' })
  })
  useEffect(() => bring(target.tileId), [target])

  return (
    <div className="min-h-0 overflow-auto bg-background px-4 pt-3 pb-8">
      <span className="mb-2 inline-flex min-h-7 items-center border border-dashed border-foreground/40 px-2.5 text-overline whitespace-nowrap text-muted-foreground uppercase">
        Still exploring · ranking optional
      </span>
      {scene.ruler.ticks.length ? (
        <p className="mt-0 mb-4 flex items-center gap-1 text-caption text-muted-foreground">
          Dates after 2028 are a guide ·
          <MockTag />
        </p>
      ) : null}
      <ol ref={listRef} aria-label="Your roadmap" className="m-0 list-none p-0">
        {rows.map((row) =>
          row.kind === 'here' ? (
            <li
              key={row.id}
              data-row={row.id}
              data-state="here"
              className={cn(styles.row, styles.here)}
            >
              <Duck size="2rem" className={styles.duck} />
              <div className={cn(styles.card, 'flex flex-col gap-4 bg-muted p-4')}>
                <RoadCard
                  key={scene.here}
                  road={road}
                  scene={scene}
                  card={card}
                  onOpen={onOpen}
                  onClose={onClose}
                  onPrimary={onPrimary}
                  onLesson={onLesson}
                  why={why}
                  ask={ask}
                  details={details}
                  posts={posts}
                  flat
                />
              </div>
            </li>
          ) : (
            <Row
              key={row.id}
              row={row}
              hintLine={road.arrival.line}
              onOpen={onOpen}
              onLesson={onLesson}
            />
          ),
        )}
      </ol>
    </div>
  )
}

const NAME = 'font-heading text-lead leading-tight font-semibold'

/** A step on the road, or the fork with its ways to PR. */
function Row({
  row,
  hintLine,
  onOpen,
  onLesson,
}: {
  row: Exclude<PhoneRow, { kind: 'here' }>
  hintLine: string
  onOpen: (tileId: string) => void
  onLesson: () => void
}) {
  if (row.kind === 'fork') {
    return (
      <li data-row={row.id} data-state="fork" className={styles.row}>
        <span aria-hidden="true" className={styles.node} />
        <div className="col-start-2 flex min-w-0 flex-col gap-2 pb-4">
          <p className="mt-3.5 mb-0 text-overline text-muted-foreground uppercase">{row.kicker}</p>
          <div className="grid grid-cols-2 gap-2">
            {row.ways.map((w) => (
              <Button
                key={w.id}
                type="button"
                variant="square"
                onClick={() => onOpen(w.id)}
                className={cn(
                  'h-auto flex-col items-stretch justify-start gap-1 p-3 text-left font-sans font-normal whitespace-normal',
                  w.thin ? 'border-dashed border-neutral-500' : 'border-2 border-neutral-500',
                )}
              >
                <span className="text-overline text-muted-foreground uppercase">{w.kicker}</span>
                <span className={cn(NAME, 'text-base')}>{w.name}</span>
                <span className="text-caption text-muted-foreground">{w.line}</span>
                <span className="mt-1 border-t pt-1.5 text-caption font-semibold">{w.end}</span>
              </Button>
            ))}
          </div>
        </div>
      </li>
    )
  }

  return (
    <li
      data-row={row.id}
      data-state={row.state}
      data-hint={row.hint || undefined}
      className={styles.row}
    >
      <span aria-hidden="true" className={styles.node} />
      <div className="col-start-2 flex min-w-0 flex-col gap-2 pb-4">
        <Button
          type="button"
          variant="ghost"
          aria-label={`${row.name}, ${STATE_WORDS[row.state]}. Open`}
          onClick={() => onOpen(row.id)}
          className="group/row h-auto min-h-11 w-full flex-col items-start justify-start gap-0.5 rounded-none px-0 py-2 text-left font-sans font-normal whitespace-normal hover:bg-transparent hover:text-foreground"
        >
          <span className="text-overline text-muted-foreground uppercase">{row.kicker}</span>
          <span
            className={cn(NAME, 'group-hover/row:underline', row.state === 'fog' && 'font-medium')}
          >
            {row.name}
          </span>
          {row.line ? <span className="text-muted-foreground">{row.line}</span> : null}
        </Button>
        {row.hint ? (
          <p
            className={cn(
              styles.bubble,
              'relative m-0 -mt-1 mb-1 flex items-center gap-2 self-start border bg-background py-2 pr-3 pl-2 text-sm font-medium shadow-lg',
            )}
          >
            <Duck size="1.5rem" className="size-6 -scale-x-100 object-contain" />
            {hintLine}
          </p>
        ) : null}
        {row.alts.length ? (
          <span className="-mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-caption text-muted-foreground">Also:</span>
            {row.alts.map((a) => (
              <Button
                key={a.id}
                type="button"
                variant="square"
                onClick={() => onOpen(a.id)}
                className="h-9 border-dashed border-foreground/45 px-2.5 font-sans text-caption font-normal"
              >
                {a.name}
              </Button>
            ))}
          </span>
        ) : null}
        {row.lesson ? <LessonLink lessonId={row.lesson} onFollow={onLesson} /> : null}
      </div>
    </li>
  )
}
