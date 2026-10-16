import * as React from 'react'

import { cn } from '@/shared/lib/utils'

/**
 * The browser's own select in the Input's frame, sized by the type roles: for a short list of
 * plain options where the Radix Select (./select.tsx) would be more than the choice needs.
 */
const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(
  ({ className, ...props }, ref) => {
    return (
      <select
        className={cn(
          'w-full border border-input bg-transparent px-2 py-1 text-caption focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
NativeSelect.displayName = 'NativeSelect'

export { NativeSelect }
