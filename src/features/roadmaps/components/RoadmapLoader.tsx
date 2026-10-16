'use client'

import { Check } from 'lucide-react'
import { useEffect, useRef } from 'react'
import motion from '@/shared/components/motion.module.css'
import { Pond } from '@/shared/components/Pond'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { useLoaderRun } from '../hooks/useLoaderRun'
import { type LoaderKind, loaderError } from '../model/loader'
import styles from './roadmaps.module.css'

export type RoadmapLoaderProps = {
  kind: LoaderKind
  /** One piece of work per step, run in order: saving, drawing, loading the list. */
  work: ReadonlyArray<() => Promise<void>>
  /** As the last step ticks: where she goes next. The loader stays until that page replaces it. */
  onDone: () => void
  /** A new roadmap's draft, made by the first step: a failure says nothing is created yet. */
  draft?: boolean
}

/**
 * The full-screen loader between finishing a roadmap and her roadmaps: the blue grid field, the
 * pond, three steps that tick as their work finishes, a note when it runs long, and on failure the
 * reason with Try again. Each step is announced once, politely, as it starts. It stays in full
 * from the last tick until the next page replaces it (no fade: faded, it showed the page it was
 * hiding). Focus never drops to the page under it: it goes to the status as the loader opens, and
 * to Try again when a step fails.
 */
export function RoadmapLoader({ kind, work, onDone, draft = false }: RoadmapLoaderProps) {
  const { steps, failed, slow, announce, retry } = useLoaderRun({ kind, work, onDone })
  const statusRef = useRef<HTMLParagraphElement>(null)
  const tryAgain = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    statusRef.current?.focus()
  }, [])
  useEffect(() => {
    if (failed) tryAgain.current?.focus()
  }, [failed])

  return (
    // Marked light: the blue field keeps its look in a dark page, as the board's does.
    <div
      data-theme="light"
      className={cn(
        motion.grid,
        '@container fixed inset-0 z-50 overflow-hidden text-panel-foreground',
      )}
    >
      <Pond className={styles.loaderPond} />
      <ol className={styles.loaderSteps}>
        {steps.map((step) => (
          <li
            key={step.text}
            data-state={step.state}
            className={cn(styles.step, 'flex items-center gap-3 font-heading text-h3 font-medium')}
          >
            <span aria-hidden="true" className={styles.mark}>
              {step.state === 'done' ? <Check strokeWidth={2.5} className="size-icon-sm" /> : null}
              {step.state === 'bad' ? <span className="text-caption font-bold">!</span> : null}
            </span>
            <span>{step.text}</span>
          </li>
        ))}
      </ol>
      {slow ? (
        <p className={cn(styles.loaderNote, 'opacity-90')}>
          Still working. This can take a little longer.
        </p>
      ) : null}
      {failed ? (
        <div role="alert" className={cn(styles.loaderNote, 'flex flex-col items-center gap-4')}>
          <p className="m-0 text-lead">{loaderError(kind, { draft })}</p>
          <Button
            ref={tryAgain}
            type="button"
            variant="strong"
            size="lg"
            onClick={retry}
            className="border-panel-foreground bg-panel-foreground px-6 text-base text-panel hover:border-panel-foreground hover:bg-panel-foreground/90 focus-visible:ring-panel-foreground focus-visible:ring-offset-panel"
          >
            Try again
          </Button>
        </div>
      ) : null}
      <p ref={statusRef} role="status" aria-live="polite" tabIndex={-1} className="sr-only">
        {announce}
      </p>
    </div>
  )
}
