'use client'

import { Ellipsis } from 'lucide-react'
import Link from 'next/link'
import { Button, buttonVariants } from '@/shared/components/ui/button'
import { useMenuKeys } from '@/shared/hooks/useMenuKeys'
import { newRoadmapPath, roadmapPath } from '@/shared/lib/student-paths'
import { cn } from '@/shared/lib/utils'

const ITEM =
  'h-auto min-h-11 w-full justify-start rounded-none px-3 text-left font-sans text-base font-normal text-foreground hover:bg-foreground/6 hover:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary'
const LINK_ITEM = cn(buttonVariants({ variant: 'ghost' }), ITEM)

/**
 * A card's "…" menu: Open, Copy and change answers, Rename and, when she has more than one roadmap,
 * Delete. It opens above its button; the keys are the account menu's (useMenuKeys). Rename and
 * Delete hand their dialog the "…" button, so focus can come back to it when the dialog closes.
 */
export function CardMenu({
  id,
  name,
  canDelete,
  onRename,
  onDelete,
}: {
  id: string
  name: string
  canDelete: boolean
  onRename: (opener: HTMLElement | null) => void
  onDelete: (opener: HTMLElement | null) => void
}) {
  const { open, setOpen, button, menu, onKeyDown } = useMenuKeys()
  const label = `More for ${name}`
  const then = (run: (opener: HTMLElement | null) => void) => () => {
    setOpen(false)
    run(button.current)
  }

  return (
    <div className="relative">
      <Button
        ref={button}
        type="button"
        variant="square"
        size="icon-lg"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className="border-transparent hover:border-foreground/30 hover:bg-transparent aria-expanded:border-foreground/30"
      >
        <Ellipsis aria-hidden="true" strokeWidth={1.5} className="size-icon-lg" />
      </Button>

      {open ? (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-0 cursor-default border-0 bg-transparent p-0"
          />
          <div
            ref={menu}
            role="menu"
            aria-label={label}
            onKeyDown={onKeyDown}
            className="absolute right-0 bottom-full z-1 mb-1 flex min-w-60 flex-col border bg-background p-1.5 text-foreground shadow-md motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200"
          >
            <Link
              href={roadmapPath(id)}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={LINK_ITEM}
            >
              Open
            </Link>
            <Link
              href={newRoadmapPath(id)}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={LINK_ITEM}
            >
              Copy and change answers
            </Link>
            <Button
              type="button"
              role="menuitem"
              variant="ghost"
              className={ITEM}
              onClick={then(onRename)}
            >
              Rename
            </Button>
            {canDelete ? (
              <>
                <hr className="mx-2 my-1 border-t border-border" />
                <Button
                  type="button"
                  role="menuitem"
                  variant="ghost"
                  className={cn(ITEM, 'text-destructive hover:text-destructive')}
                  onClick={then(onDelete)}
                >
                  Delete
                </Button>
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
