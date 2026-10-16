import { cn } from '@/shared/lib/utils'

/** The dashed "mock" tag after a line whose figures are preview data. */
export function MockTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'border border-dashed border-muted-foreground px-1 text-micro uppercase',
        className,
      )}
    >
      mock
    </span>
  )
}
