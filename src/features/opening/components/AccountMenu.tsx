'use client'

import { ListChecks, LogOut, Map as MapIcon, Moon, Newspaper, Sun, User } from 'lucide-react'
import Link from 'next/link'
import { useSignOut } from '@/features/auth'
import { useThemeChoice } from '@/shared/components/Providers'
import { Button } from '@/shared/components/ui/button'
import { useMenuKeys } from '@/shared/hooks/useMenuKeys'
import { FEED_PATH } from '@/shared/lib/auth/gate'
import { HEADER_ACTION_ON_STEEL } from '@/shared/lib/header-action'
import { ROADMAPS_PATH } from '@/shared/lib/student-paths'
import { toggledChoice } from '@/shared/lib/theme'
import { cn } from '@/shared/lib/utils'

const ITEM =
  'group flex min-h-11 cursor-pointer items-center gap-3 border-0 bg-transparent px-3 text-left text-foreground hover:bg-foreground/6 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary'

/**
 * The onboarding header's one button (the design's `.hdr`): a menu with Your roadmaps first, then the Feed, then on
 * a board Your answers (`onAnswers` opens them over it), Dark theme, a checkable item whose drawn
 * switch shows its state, and Sign out. Opening focuses the first item; the arrow
 * keys, Home and End move between items; Escape, Tab or a click outside closes it. Below @5xl it
 * sits in the steel band, so the button turns light on steel (`band`; the road's header has no
 * band, so it says false); the open menu keeps the page's colours.
 */
export function AccountMenu({
  className,
  band = true,
  onAnswers,
}: {
  className?: string
  band?: boolean
  onAnswers?: () => void
}) {
  const { theme, setChoice } = useThemeChoice()
  const { leave } = useSignOut()
  const { open, setOpen, button, menu, onKeyDown } = useMenuKeys()
  const dark = theme === 'dark'

  return (
    <div className={cn('relative', className)}>
      <Button
        ref={button}
        type="button"
        variant="square"
        size="icon-lg"
        aria-label="Menu: theme and sign out"
        title="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className={cn(
          'shrink-0 aria-expanded:border-accent-700 aria-expanded:bg-accent-100 aria-expanded:text-accent-800',
          band && [
            HEADER_ACTION_ON_STEEL,
            '@max-5xl:aria-expanded:border-panel-foreground @max-5xl:aria-expanded:bg-panel-foreground/14 @max-5xl:aria-expanded:text-panel-foreground',
          ],
        )}
      >
        <User aria-hidden="true" strokeWidth={1.5} className="size-icon" />
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
            aria-label="Menu"
            onKeyDown={onKeyDown}
            className="absolute top-full right-0 z-1 mt-2 flex min-w-56 flex-col border bg-background p-1.5 text-foreground shadow-md motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200"
          >
            <Link
              href={ROADMAPS_PATH}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={ITEM}
            >
              <MapIcon
                aria-hidden="true"
                strokeWidth={1.5}
                className="size-icon text-neutral-700"
              />
              <span className="flex-1">Your roadmaps</span>
            </Link>
            <Link href={FEED_PATH} role="menuitem" onClick={() => setOpen(false)} className={ITEM}>
              <Newspaper
                aria-hidden="true"
                strokeWidth={1.5}
                className="size-icon text-neutral-700"
              />
              <span className="flex-1">Feed</span>
            </Link>
            {onAnswers ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onAnswers()
                }}
                className={ITEM}
              >
                <ListChecks
                  aria-hidden="true"
                  strokeWidth={1.5}
                  className="size-icon text-neutral-700"
                />
                <span className="flex-1">Your answers</span>
              </button>
            ) : null}
            <hr className="mx-2 my-1 border-t border-border" />
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={dark}
              onClick={() => setChoice(toggledChoice(theme))}
              className={ITEM}
            >
              {dark ? (
                <Sun aria-hidden="true" strokeWidth={1.5} className="size-icon text-neutral-700" />
              ) : (
                <Moon aria-hidden="true" strokeWidth={1.5} className="size-icon text-neutral-700" />
              )}
              <span className="flex-1">Dark theme</span>
              <span
                aria-hidden="true"
                className="relative h-5 w-9 flex-none border border-foreground/45 group-aria-checked:border-accent-700 group-aria-checked:bg-accent-700 motion-safe:transition-colors motion-safe:duration-200"
              >
                <span className="absolute top-0.75 left-0.75 size-3 bg-foreground/60 group-aria-checked:translate-x-4 group-aria-checked:bg-background motion-safe:transition motion-safe:duration-250" />
              </span>
            </button>
            <hr className="mx-2 my-1 border-t border-border" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                void leave()
              }}
              className={ITEM}
            >
              <LogOut aria-hidden="true" strokeWidth={1.5} className="size-icon text-neutral-700" />
              <span className="flex-1">Sign out</span>
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
