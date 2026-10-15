'use client'

import { ArrowRight, CircleAlert, Layers, Split } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { FrameMarks } from '@/shared/components/Blueprint'
import { Duck } from '@/shared/components/Duck'
import { Note } from '@/shared/components/Note'
import { Button, buttonVariants } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { useBoardPath } from '../hooks/useBoardPath'
import { type Card, siblingsOf } from '../model/press'
import type { BadgeId, Road, Tile } from '../model/road-data'
import { routePath } from '../model/routes'
import type { Scene } from '../model/scene'
import { LessonLink } from './LessonLink'
import { MockTag } from './MockTag'

const BADGE_ICONS = { layers: Layers, alert: CircleAlert, split: Split }

/**
 * A sibling's lines under its name: a stack's count; a visited course's trade-off after "Visited";
 * else its kicker, or its trade-off, what it is good for over what it is less good for.
 */
function siblingLines(t: Tile): string[] {
  const trade = [t.gains, t.costs].filter((x): x is string => !!x)
  if (t.kind === 'stack') return t.sub ? [t.sub] : []
  if (t.kicker === 'Visited')
    return trade.length ? [`Visited · ${trade[0]}`, ...trade.slice(1)] : ['Visited']
  if (t.kicker) return [t.kicker]
  if (trade.length) return trade
  return t.sub ? [t.sub] : []
}

const ACTION = 'h-12 w-full'

/**
 * The card column's card: where she is (no tile open), or the tile she pressed, per cardFor. Its
 * badges open their explanation; a sibling opens that tile; the primary does what the board says
 * (`onPrimary`; without one it is drawn and does nothing this round); route detail and the lesson
 * are links (they push, so Back returns); Cancel (or Back to where she is) closes the card. "What
 * it asks for" and "More" do nothing yet. `flat`: the card inside the phone's road, its guide
 * without a box, its badges side by side and no course actions. The name where she is and each
 * sibling carry their tile (`data-swap-id`), so a swap can move them.
 */
export function RoadCard({
  road,
  scene,
  card,
  onOpen,
  onClose,
  onPrimary,
  onLesson,
  flat = false,
}: {
  road: Road
  scene: Scene
  card: Card
  onOpen: (tileId: string) => void
  onClose: () => void
  onPrimary?: () => void
  /** A lesson link was followed from the board. */
  onLesson: () => void
  flat?: boolean
}) {
  const here = card.kind === 'here'
  const siblings = here ? siblingsOf(scene) : []
  const board = useBoardPath()
  const hereTile = scene.tiles.find((t) => t.id === scene.here)
  const course = here && hereTile?.kind === 'course' && !flat
  const trade = card.gains && card.costs

  return (
    <>
      <p className="m-0 text-overline text-muted-foreground uppercase">{card.kicker}</p>
      <h1 data-swap-id={here ? scene.here : undefined} className="-mt-2 mb-0 text-h2 leading-none">
        {card.name}
      </h1>
      <p className="-mt-3 mb-0 text-muted-foreground">{card.sub}</p>

      {trade || card.guide || !here ? (
        <div className={cn('flex flex-col gap-2', !flat && 'border bg-muted px-4 py-3.5')}>
          {flat ? null : (
            <span className="flex items-center gap-2 text-overline text-muted-foreground uppercase">
              <Duck size="1.25rem" className="size-5 -scale-x-100 object-contain" />
              Your guide
            </span>
          )}
          {trade ? (
            <p className="m-0 flex flex-col">
              <span className="font-medium text-accent-800">{card.gains}</span>
              <span className="font-medium text-danger-700">{card.costs}</span>
            </p>
          ) : null}
          {card.guide ? <p className="m-0">{card.guide}</p> : null}
          <p className="m-0 flex items-center gap-1 text-caption text-muted-foreground">
            Source: OfCourse preview data ·
            <MockTag />
          </p>
        </div>
      ) : null}

      {card.badges.length ? <Badges ids={card.badges} badges={road.badges} flat={flat} /> : null}

      <p className="m-0 text-caption">
        <span className="text-muted-foreground">On your board because:</span> {card.because}
      </p>

      {card.lesson ? <LessonLink lessonId={card.lesson} onFollow={onLesson} /> : null}

      {siblings.length && card.siblingsTitle ? (
        <div className="flex flex-col gap-1.5 border-t pt-3">
          <span className="text-overline text-muted-foreground uppercase">
            {card.siblingsTitle}
          </span>
          {siblings.map((t) => (
            <Button
              key={t.id}
              type="button"
              variant="square"
              data-swap-id={t.id}
              onClick={() => onOpen(t.id)}
              className={cn(
                'h-auto min-h-11 flex-col items-start gap-0.5 px-3 py-2 text-left font-sans text-base font-normal whitespace-normal',
                t.state === 'lit' ? 'bg-background' : 'border-dashed border-foreground/40',
              )}
            >
              <span className="font-semibold">
                {t.name}
                {t.kind === 'stack' ? null : (
                  <span className="font-normal text-muted-foreground">
                    {' '}
                    · {(t.sub ?? '').split(' · ')[0]}
                  </span>
                )}
              </span>
              <span className="flex flex-col text-caption text-muted-foreground">
                {siblingLines(t).map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </span>
            </Button>
          ))}
        </div>
      ) : null}

      {course ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="square" className="h-11 px-3.5 font-sans font-medium">
            What it asks for
          </Button>
          <Button type="button" variant="square" className="h-11 px-3.5 font-sans font-medium">
            More
          </Button>
        </div>
      ) : null}

      <div className="mt-auto flex flex-col gap-2 pt-2">
        {card.primary && card.kind === 'look' && card.routeId ? (
          <Link
            href={routePath(board, card.routeId)}
            className={cn(buttonVariants({ variant: 'strong' }), ACTION)}
          >
            <FrameMarks spread />
            {card.primary}
          </Link>
        ) : card.primary ? (
          <Button type="button" variant="strong" className={ACTION} onClick={onPrimary}>
            {card.primary}
            {here ? (
              <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-icon-sm" />
            ) : null}
          </Button>
        ) : null}
        {card.secondary && here && card.routeId ? (
          <Link
            href={routePath(board, card.routeId)}
            className={cn(buttonVariants({ variant: 'outline' }), ACTION)}
          >
            <FrameMarks spread />
            {card.secondary}
          </Link>
        ) : card.secondary && !here ? (
          <Button type="button" variant="outline" className={ACTION} onClick={onClose}>
            {card.secondary}
          </Button>
        ) : null}
      </div>
    </>
  )
}

/** The card's badges: each a button that opens its explanation below it; flat, side by side. */
function Badges({ ids, badges, flat }: { ids: BadgeId[]; badges: Road['badges']; flat: boolean }) {
  const [open, setOpen] = useState<BadgeId[]>([])
  return (
    <div className={cn('flex flex-col gap-1.5', flat && 'flex-row flex-wrap')}>
      {ids.map((id) => {
        const b = badges[id]
        const Icon = BADGE_ICONS[b.icon]
        const isOpen = open.includes(id)
        return (
          <div key={id} className={cn('flex flex-col gap-1', flat && isOpen && 'basis-full')}>
            <Button
              type="button"
              variant="square"
              aria-expanded={isOpen}
              onClick={() =>
                setOpen((was) => (isOpen ? was.filter((x) => x !== id) : [...was, id]))
              }
              className={cn(
                'h-auto min-h-11 w-full justify-start gap-2.5 px-3 py-1.5 text-left font-sans font-normal whitespace-normal aria-expanded:border-accent-700 aria-expanded:bg-accent-100',
                flat && 'min-h-10 w-auto self-start bg-background px-2.5 text-caption',
              )}
            >
              <Icon aria-hidden="true" strokeWidth={1.5} className="size-icon-sm text-accent-700" />
              <span>
                <b>{b.kind}</b> · {b.value}
              </span>
            </Button>
            {isOpen ? (
              <Note tone="hint" icon={null} appear className={cn('text-sm', !flat && 'px-3')}>
                {b.explanation}
              </Note>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
