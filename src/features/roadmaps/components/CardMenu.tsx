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

/** What a roadmap's menu and its row can do; each hands over the element focus goes back to. */
export type RowActions = {
  rename: (id: string, opener: HTMLElement | null) => void
  remove: (id: string, opener: HTMLElement | null) => void
  archive: (id: string, opener: HTMLElement | null) => void
  restore: (id: string, opener: HTMLElement | null) => void
}

/**
 * A roadmap's "…" menu: Open, Copy and change answers, Rename, Archive and Delete; an archived
 * one's is Restore and Delete. While she has one roadmap out of the archive (`canPutAway` false)
 * it has no Archive and no Delete, but an archived one may always go. It opens under its button;
 * the keys are the account menu's (useMenuKeys). Each action hands over the "…" button, so focus
 * can come back to it.
 */
export function CardMenu({
  roadmap: { id, name, archived },
  canPutAway,
  actions,
}: {
  roadmap: { id: string; name: string; archived: boolean }
  canPutAway: boolean
  actions: RowActions
}) {
  const { open, setOpen, button, menu, onKeyDown } = useMenuKeys()
  const label = `More for ${name}`
  const then = (run: (id: string, opener: HTMLElement | null) => void) => () => {
    setOpen(false)
    run(id, button.current)
  }
  const canDelete = archived || canPutAway

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
            className="absolute top-full right-0 z-1 mt-1 flex min-w-60 flex-col border bg-background p-1.5 text-foreground shadow-md motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200"
          >
            {archived ? (
              <Button
                type="button"
                role="menuitem"
                variant="ghost"
                className={ITEM}
                onClick={then(actions.restore)}
              >
                Restore
              </Button>
            ) : (
              <>
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
                  onClick={then(actions.rename)}
                >
                  Rename
                </Button>
                {canPutAway ? (
                  <Button
                    type="button"
                    role="menuitem"
                    variant="ghost"
                    className={ITEM}
                    onClick={then(actions.archive)}
                  >
                    Archive
                  </Button>
                ) : null}
              </>
            )}
            {canDelete ? (
              <>
                <hr className="mx-2 my-1 border-t border-border" />
                <Button
                  type="button"
                  role="menuitem"
                  variant="ghost"
                  className={cn(ITEM, 'text-destructive hover:text-destructive')}
                  onClick={then(actions.remove)}
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
