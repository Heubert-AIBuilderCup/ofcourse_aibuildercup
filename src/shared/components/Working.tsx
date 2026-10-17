import { Loader2 } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

/**
 * The loader of work in progress: a spinner, held still when the reader asks for reduced motion;
 * 14px beside words, 20px alone.
 */
export function Spin({ alone = false }: { alone?: boolean }) {
  return (
    <Loader2
      aria-hidden
      strokeWidth={1.5}
      className={cn('shrink-0 motion-safe:animate-spin', alone ? 'size-icon-lg' : 'size-icon-sm')}
    />
  )
}

/**
 * Work in progress, shown where its result will appear: the loader and what is happening in
 * words, counted where it can be ("Drawing image 2 of 4"). A status, so a screen reader hears it
 * change.
 */
export function Working({ words, className }: { words: string; className?: string }) {
  return (
    <p
      role="status"
      className={cn('flex items-center gap-2 text-caption text-muted-foreground', className)}
    >
      <Spin />
      {words}
    </p>
  )
}
