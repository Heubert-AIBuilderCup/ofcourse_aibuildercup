import { Columns2, MessageCircle } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import type { Weight } from '../model/road-data'

const CONTROL =
  'h-auto min-h-15 flex-col gap-1 rounded-none px-1 py-1.5 font-sans text-caption font-normal'

/**
 * Below 64rem the board's controls sit in a bar along its foot: Ask, Weights (her weights as bars),
 * Compare. None acts this round.
 */
export function ControlsBar({ weights }: { weights: Weight[] }) {
  return (
    <nav aria-label="Controls" className="hidden grid-cols-3 border-t bg-background @max-5xl:grid">
      <Button type="button" variant="ghost" className={CONTROL}>
        <MessageCircle aria-hidden="true" strokeWidth={1.5} className="size-icon-lg" />
        Ask · 1
      </Button>
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
      <Button type="button" variant="ghost" className={cn(CONTROL, 'border-l')}>
        <Columns2 aria-hidden="true" strokeWidth={1.5} className="size-icon-lg" />
        Compare
      </Button>
    </nav>
  )
}
