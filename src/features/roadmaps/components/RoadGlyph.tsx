import { cn } from '@/shared/lib/utils'

/**
 * A roadmap's small road, beside its name: a vertical line ending in a diamond. In the accent on
 * the one she opened last (`on`), and on hover of its row (a `group/row`). Decoration only.
 */
export function RoadGlyph({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" className="relative mt-0.5 h-10 w-5 flex-none">
      <span
        className={cn(
          'absolute inset-y-1 left-1/2 w-0.75 -translate-x-1/2 transition-colors duration-200',
          on ? 'bg-primary' : 'bg-foreground/25 group-hover/row:bg-primary/60',
        )}
      />
      <span
        className={cn(
          'absolute bottom-0 left-1/2 size-2.5 -translate-x-1/2 rotate-45 border-2 transition-colors duration-200',
          on
            ? 'border-primary bg-primary'
            : 'border-foreground/40 bg-background group-hover/row:border-primary',
        )}
      />
    </span>
  )
}
