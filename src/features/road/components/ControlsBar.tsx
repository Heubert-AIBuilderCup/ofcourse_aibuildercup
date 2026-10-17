import { ListChecks, Newspaper, Search } from 'lucide-react'
import Link from 'next/link'
import { Button, buttonVariants } from '@/shared/components/ui/button'
import { FEED_PATH } from '@/shared/lib/auth/gate'
import { cn } from '@/shared/lib/utils'
import type { Weight } from '../model/road-data'

const CONTROL =
  'h-auto min-h-15 flex-col gap-1 rounded-none px-1 py-1.5 font-sans text-caption font-normal'

/** The bar's columns by how many controls it holds. */
const COLUMNS = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' } as const

/**
 * Below 64rem the board's controls sit in a bar along its foot: Feed, Your answers, Find (the
 * course finder, when it is on), Weights (her weights as bars). Weights does nothing this round.
 */
export function ControlsBar({
  weights,
  onAnswers,
  onFind,
}: {
  weights: Weight[]
  /** Opens Your answers over the board; absent on a draft, where they are already open. */
  onAnswers?: () => void
  /** Opens Find courses over the board; absent while the finder is off. */
  onFind?: () => void
}) {
  const count = (2 + (onAnswers ? 1 : 0) + (onFind ? 1 : 0)) as keyof typeof COLUMNS
  return (
    <nav
      aria-label="Controls"
      className={cn('hidden border-t bg-background @max-5xl:grid', COLUMNS[count])}
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
      {onFind ? (
        <Button type="button" variant="ghost" className={cn(CONTROL, 'border-l')} onClick={onFind}>
          <Search aria-hidden="true" strokeWidth={1.5} className="size-icon-lg" />
          Find
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
