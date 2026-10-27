import { Check } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/shared/lib/utils'

import { type StepId, type StepState, stepPath } from '../lib/steps'

/** Each step's mark, as the student app's loader draws its steps: done ticked, now ringed, next dashed. */
const MARK: Record<StepState, string> = {
  done: 'border-primary-strong bg-primary-strong text-primary-strong-foreground',
  current:
    'border-2 border-accent-700 text-accent-700 shadow-[0_0_0_0.25rem_var(--color-accent-100)]',
  open: 'border-foreground/40 text-foreground',
  todo: 'border-dashed border-foreground/40 text-muted-foreground',
}

/**
 * The numbered step bar (GD25, GD27): Source → Ideas (a post with idea cards only) → Text →
 * Images → Review → Live, from lib/steps.ts stepsFor, one mark per step on one line: done steps
 * ticked and the line behind them in the accent, the current one ringed, the rest dashed. Done
 * and current steps link to their own screens, keeping the board filters "← Board" returns to;
 * steps not reached are plain text. The current step says where the post is, so there is no gate
 * badge beside it, and the open screen is marked as the page (its name underlined).
 */
export function StageRail({
  postId,
  steps,
  open,
  from,
}: {
  postId: string
  steps: { id: StepId; label: string; state: StepState }[]
  /** The step whose screen is shown. */
  open: StepId
  /** The board's filters, as lib/board.ts boardFrom keeps them; '' for none. */
  from: string
}) {
  return (
    <ol
      aria-label="Stages"
      className="flex items-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {steps.map((step, i) => {
        const look = cn(
          'relative z-1 flex min-h-14 w-full flex-col items-center gap-1.5 text-caption no-underline',
          step.state === 'todo' ? 'text-muted-foreground' : 'text-foreground',
          step.state === 'current' && 'font-semibold',
        )
        // The ordered list gives the position to a screen reader; the mark is for the eye.
        const mark = (
          <span
            aria-hidden="true"
            className={cn(
              'flex size-8.5 items-center justify-center border bg-background font-heading font-semibold',
              MARK[step.state],
            )}
          >
            {step.state === 'done' ? (
              <Check strokeWidth={1.5} className="size-icon-xs" />
            ) : (
              <span className="tabular-nums">{i + 1}</span>
            )}
          </span>
        )
        const name = (
          <span className={cn(step.id === open && 'underline underline-offset-4')}>
            {step.label}
          </span>
        )
        return (
          <li
            key={step.id}
            aria-current={step.state === 'current' ? 'step' : undefined}
            className={cn(
              'relative min-w-26 flex-1 @max-xl:min-w-18',
              // The line to the next step, from this mark's centre to the next one's.
              'not-last:after:absolute not-last:after:top-4 not-last:after:left-1/2 not-last:after:h-0.75 not-last:after:w-full',
              step.state === 'done' ? 'after:bg-accent-600' : 'after:bg-foreground/20',
            )}
          >
            {step.state === 'todo' ? (
              <span className={look}>
                {mark}
                {name}
              </span>
            ) : (
              <Link
                href={`${stepPath(postId, step.id)}${from ? `?from=${encodeURIComponent(from)}` : ''}`}
                aria-current={step.id === open ? 'page' : undefined}
                className={cn(
                  look,
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                )}
              >
                {mark}
                {name}
              </Link>
            )}
          </li>
        )
      })}
    </ol>
  )
}
