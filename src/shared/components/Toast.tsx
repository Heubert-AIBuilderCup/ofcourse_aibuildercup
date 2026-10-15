'use client'

import { useEffect, useEffectEvent } from 'react'
import motion from '@/shared/components/motion.module.css'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

/** How long a toast stays, in ms (spec §9): longer when it carries Undo. */
export const TOAST_MS = { undo: 4500, plain: 3200 }

/**
 * What an action did, said politely over the board or the list, with Undo when it can be undone (Undo lives only
 * here), or Open it for what was just made. It goes by itself after its time; key it by the action
 * so a new one restarts the clock. `place`: where it sits over what it is in, when not over the
 * map's foot.
 */
export function Toast({
  text,
  onUndo,
  onOpen,
  onDone,
  place = 'bottom-24 @max-5xl:bottom-20',
}: {
  text: string
  onUndo?: () => void
  onOpen?: () => void
  onDone: () => void
  place?: string
}) {
  const done = useEffectEvent(onDone)
  // With a button to press, it stays as long as one with Undo.
  const action = onUndo
    ? { label: 'Undo', run: onUndo }
    : onOpen
      ? { label: 'Open it', run: onOpen }
      : null
  const actionable = !!action
  useEffect(() => {
    const timer = setTimeout(() => done(), actionable ? TOAST_MS.undo : TOAST_MS.plain)
    return () => clearTimeout(timer)
  }, [actionable])

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
        {action ? (
          <Button
            type="button"
            variant="square"
            onClick={action.run}
            className="h-11 shrink-0 border-current px-3.5 font-heading text-base text-background hover:border-current hover:bg-background/12"
          >
            {action.label}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
