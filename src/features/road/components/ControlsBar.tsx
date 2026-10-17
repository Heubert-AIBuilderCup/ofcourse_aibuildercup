import { ListChecks, Newspaper } from 'lucide-react'
import Link from 'next/link'
import { Button, buttonVariants } from '@/shared/components/ui/button'
import { FEED_PATH } from '@/shared/lib/auth/gate'
import { cn } from '@/shared/lib/utils'
import type { Weight } from '../model/road-data'

const CONTROL =
  'h-auto min-h-15 flex-col gap-1 rounded-none px-1 py-1.5 font-sans text-caption font-normal'

/**
 * Below 64rem the board's controls sit in a bar along its foot: Feed, Your answers, Weights (her
 * weights as bars). Weights does nothing this round.
 */
export function ControlsBar({
  weights,
  onAnswers,
}: {
  weights: Weight[]
  /** Opens Your answers over the board; absent on a draft, where they are already open. */
  onAnswers?: () => void
}) {
  return (
    <nav
      aria-label="Controls"
      className={cn(
        'hidden border-t bg-background @max-5xl:grid',
        onAnswers ? 'grid-cols-3' : 'grid-cols-2',
      )}
    >
      <Link href={FEED_PATH} className={cn(buttonVariants({ variant: 'ghost' }), CONTROL)}>
        <Newspaper aria-hidden="true" strokeWidth={1.5} className="size-icon-lg" />
        Feed
      </Link>
      {onAnswers ? (
        <Button
          type="button"
          variant="ghost"
          className={cn(CONTROL, 'border-l')}
          onClick={onAnswers}
        >
          <ListChecks aria-hidden="true" strokeWidth={1.5} className="size-icon-lg" />
          Your answers
        </Button>
      ) : null}
      <Button type="button" variant="ghost" className={cn(CONTROL, 'border-l')}>
        <span aria-hidden="true" className="inline-flex h-5 items-end gap-0.5">
          {weights.map((w) => (
            <i
              key={w.name}
              className="block min-h-0.5 w-0.75 bg-current"
              style={{ height: `${Math.round((w.weight / 3) * 100)}%` }}
            />
          ))}
        </span>
        Weights
      </Button>
    </nav>
  )
}
