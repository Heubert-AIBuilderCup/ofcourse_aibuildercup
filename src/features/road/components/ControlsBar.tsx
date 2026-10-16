import { Columns2, ListChecks, MessageCircle } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import type { Weight } from '../model/road-data'

const CONTROL =
  'h-auto min-h-15 flex-col gap-1 rounded-none px-1 py-1.5 font-sans text-caption font-normal'

/**
 * Below 64rem the board's controls sit in a bar along its foot: Ask, Weights (her weights as bars),
 * Compare. Ask and Compare are not here yet (`onLater` says so); Weights does nothing this round.
 */
export function ControlsBar({
  weights,
  onLater,
  onAnswers,
}: {
  weights: Weight[]
  onLater: () => void
  /** Opens Your answers over the board; absent on a draft, where they are already open. */
  onAnswers?: () => void
}) {
  return (
    <nav
      aria-label="Controls"
      className={cn(
        'hidden border-t bg-background @max-5xl:grid',
        onAnswers ? 'grid-cols-4' : 'grid-cols-3',
      )}
    >
      <Button type="button" variant="ghost" className={CONTROL} onClick={onLater}>
        <MessageCircle aria-hidden="true" strokeWidth={1.5} className="size-icon-lg" />
        Ask · 1
      </Button>
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
      <Button type="button" variant="ghost" className={cn(CONTROL, 'border-l')} onClick={onLater}>
        <Columns2 aria-hidden="true" strokeWidth={1.5} className="size-icon-lg" />
        Compare
      </Button>
    </nav>
  )
}
