'use client'

import { type ReactNode, type Ref, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

/**
 * "Archived (n)" at the foot of the list: closed until she opens it, then her archived roadmaps,
 * as the list above shows its own. `toggle` lets the page give focus to it when a roadmap moves.
 */
export function ArchivedFold({
  count,
  toggle,
  children,
}: {
  count: number
  toggle: Ref<HTMLButtonElement>
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <section className="flex flex-col gap-4 border-t pt-2">
      <Button
        ref={toggle}
        type="button"
        variant="text"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className="gap-2 self-start px-1 text-base font-semibold text-muted-foreground hover:text-foreground"
      >
        <span
          aria-hidden="true"
          className={cn(
            'size-2 -rotate-45 border-r-2 border-b-2 border-current motion-safe:transition-transform motion-safe:duration-200',
            open && 'rotate-45',
          )}
        />
        Archived ({count})
      </Button>
      {open ? children : null}
    </section>
  )
}
