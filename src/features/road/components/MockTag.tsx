import { cn } from '@/shared/lib/utils'

/** The dashed tag after a line whose figures are preview data: "mock" unless `label` says else. */
export function MockTag({ label = 'mock', className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        'border border-dashed border-muted-foreground px-1 text-micro uppercase',
        className,
      )}
    >
      {label}
    </span>
  )
}
