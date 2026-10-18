import type { ReactNode } from 'react'
import motion from '@/shared/components/motion.module.css'
import { cn } from '@/shared/lib/utils'

/**
 * A step's actions, the last beat of its rise. At every width they stick to the bottom of the
 * screen over the page's background, so Continue stays in view however long the options run; on a
 * phone (below @xl) they are a full-width bar with a hairline, within thumb reach. `className`
 * places them (justify-*).
 */
export function StepActions({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        motion.rise,
        motion.d8,
        'sticky bottom-0 z-5 mt-1 flex items-center gap-3.5 bg-background py-3',
        '@max-xl:-mx-4 @max-xl:border-t @max-xl:px-4 @max-xl:pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
        className,
      )}
    >
      {children}
    </div>
  )
}
