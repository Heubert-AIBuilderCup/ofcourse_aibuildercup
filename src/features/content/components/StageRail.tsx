import Link from 'next/link'
import { cn } from '@/shared/lib/utils'

import { type StepId, type StepState, stepPath } from '../lib/steps'

/**
 * The numbered step bar (GD25, GD27): Source → Ideas (a post with idea cards only) → Text →
 * Images → Review → Live, from lib/steps.ts stepsFor. Done and current steps link to their own
 * screens, keeping the board filters "← Board" returns to; steps not reached are plain text. The
 * current step says where the post is, so there is no gate badge beside it, and the open screen
 * is marked as the page.
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
    <ol aria-label="Stages" className="flex flex-wrap items-center gap-2 text-caption">
      {steps.map((step, i) => {
        const look = cn(
          'flex items-center gap-1.5 border px-2 py-0.5',
          step.state === 'current'
            ? 'border-primary font-heading font-semibold text-foreground'
            : 'border-transparent',
          step.state === 'todo' && 'text-muted-foreground',
          step.id === open && step.state !== 'current' && 'border-border',
        )
        // The ordered list gives the position to a screen reader; the number is for the eye.
        const number = (
          <span aria-hidden="true" className="tabular-nums text-muted-foreground">
            {i + 1}
          </span>
        )
        return (
          <li
            key={step.id}
            aria-current={step.state === 'current' ? 'step' : undefined}
            className={cn(
              'flex items-center',
              // The arrow is drawn, not text, so each step reads as its own name.
              i > 0 && "before:mr-2 before:text-muted-foreground before:content-['→']",
            )}
          >
            {step.state === 'todo' ? (
              <span className={look}>
                {number}
                {step.label}
              </span>
            ) : (
              <Link
                href={`${stepPath(postId, step.id)}${from ? `?from=${encodeURIComponent(from)}` : ''}`}
                aria-current={step.id === open ? 'page' : undefined}
                className={cn(look, 'underline-offset-4 hover:underline')}
              >
                {number}
                {step.label}
              </Link>
            )}
          </li>
        )
      })}
    </ol>
  )
}
