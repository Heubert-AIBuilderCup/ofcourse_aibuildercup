import type { ReactNode } from 'react'
import motion from '@/shared/components/motion.module.css'
import { cn } from '@/shared/lib/utils'

/**
 * A step's actions, the last beat of its rise. On a phone (below @xl) they sit in a bar at the
 * bottom of the screen, within thumb reach. `className` places them (justify-*).
 */
export function StepActions({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        motion.rise,
        motion.d8,
        'mt-1 flex items-center gap-3.5',
        '@max-xl:sticky @max-xl:bottom-0 @max-xl:z-5 @max-xl:-mx-4 @max-xl:border-t @max-xl:bg-background @max-xl:px-4 @max-xl:pt-3 @max-xl:pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
        className,
      )}
    >
      {children}
    </div>
  )
}
