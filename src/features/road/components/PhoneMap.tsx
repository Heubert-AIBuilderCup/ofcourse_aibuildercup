'use client'

import Link from 'next/link'
import type { ComponentProps } from 'react'
import { FrameMarks } from '@/shared/components/Blueprint'
import { Button, buttonVariants } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { useBoardPath } from '../hooks/useBoardPath'
import type { Card } from '../model/press'
import { routePath } from '../model/routes'
import { RoadMap } from './RoadMap'

const ACTION = 'h-11 flex-1'

/**
 * The peek's lines: a pressed tile's trade-off (good for, then less good for), else its guide;
 * where she is, her tile's trade-off, else her card's sub.
 */
function peekLines(card: Card, trade: string[]): string[] {
  if (card.kind === 'here') return trade.length ? trade : [card.sub]
  if (card.gains && card.costs) return [card.gains, card.costs]
  return [card.guide ?? card.sub]
}

/**
 * The phone's Map view: the map, with the card folded to its first lines over its foot (the peek):
 * its kicker, its name, one line and its primary; with a pressed tile open, Cancel (or Back to where
 * she is) beside it. Under her answers' sheet there is no peek: the map above it is the preview.
 */
export function PhoneMap({
  card,
  onClose,
  onPrimary,
  ...map
}: ComponentProps<typeof RoadMap> & {
  /** The card open: where she is, or the pressed tile's. */
  card: Card
  onClose: () => void
  onPrimary?: () => void
}) {
  const here = card.kind === 'here'
  const hereTile = map.scene.tiles.find((t) => t.id === map.scene.here)
  const trade = [hereTile?.gains, hereTile?.costs].filter((x): x is string => !!x)
  const board = useBoardPath()
  return (
    <RoadMap {...map}>
      {map.answering ? null : (
        <section
          aria-label={here ? 'Where you are' : 'The tile you pressed'}
          data-map-control
          className="absolute inset-x-0 bottom-0 z-30 flex flex-col gap-1 border-t bg-background px-4 pt-3.5 pb-4 text-foreground shadow-lg"
        >
          <p className="m-0 text-overline text-muted-foreground uppercase">{card.kicker}</p>
          <h1 className="m-0 text-h3 leading-tight">{card.name}</h1>
          <p className="m-0 flex flex-col text-sm text-muted-foreground">
            {peekLines(card, trade).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </p>
          <div className="mt-2 flex gap-2">
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
              </Button>
            ) : null}
            {here ? null : (
              <Button type="button" variant="outline" className={ACTION} onClick={onClose}>
                {card.secondary ?? 'Cancel'}
              </Button>
            )}
          </div>
        </section>
      )}
      {map.children}
    </RoadMap>
  )
}
