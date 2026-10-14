'use client'

import { useEffect, useEffectEvent } from 'react'
import motion from '@/shared/components/motion.module.css'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

/** How long a toast stays, in ms (spec §9): longer when it carries Undo. */
export const TOAST_MS = { undo: 4500, plain: 3200 }

/**
 * What an action did, said politely over the map, with Undo when it can be undone (Undo lives only
 * here). It goes by itself after its time; key it by the action so a new one restarts the clock.
 * `place`: where it sits over what it is in, when not over the map's foot.
 */
export function Toast({
  text,
  onUndo,
  onDone,
  place = 'bottom-24 @max-5xl:bottom-20',
}: {
  text: string
  onUndo?: () => void
  onDone: () => void
  place?: string
}) {
  const done = useEffectEvent(onDone)
  const undoable = !!onUndo
  useEffect(() => {
    const timer = setTimeout(() => done(), undoable ? TOAST_MS.undo : TOAST_MS.plain)
    return () => clearTimeout(timer)
  }, [undoable])

  return (
    <div
      role="status"
      aria-live="polite"
      data-map-control
      className={cn('pointer-events-none absolute inset-x-4 z-40 flex justify-center', place)}
    >
      <div
        className={cn(
          motion.noteInQuick,
          'pointer-events-auto flex max-w-xl items-center gap-4 bg-foreground py-3 pr-3 pl-4 text-background shadow-lg',
        )}
      >
        <span>{text}</span>
        {onUndo ? (
          <Button
            type="button"
            variant="square"
            onClick={onUndo}
            className="h-11 shrink-0 border-current px-3.5 font-heading text-base text-background hover:border-current hover:bg-background/12"
          >
            Undo
          </Button>
        ) : null}
      </div>
    </div>
  )
}
