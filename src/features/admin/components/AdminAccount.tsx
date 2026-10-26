'use client'

import { ChevronDown, LogOut, Moon, Sun } from 'lucide-react'
import { useSignOut } from '@/features/auth'
import { useThemeChoice } from '@/shared/components/Providers'
import { useMenuKeys } from '@/shared/hooks/useMenuKeys'
import { ADMIN_SIGNIN_PATH } from '@/shared/lib/auth/gate'
import { toggledChoice } from '@/shared/lib/theme'

const ITEM =
  'group flex min-h-11 cursor-pointer items-center gap-3 border-0 bg-transparent px-3 text-left text-foreground hover:bg-foreground/6 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary'

/** "MR" for "Maya Rai": the first letters of the first two words. */
const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase()

/**
 * The account button at the end of the admin bar: the viewer's initials, name and role (their
 * real role, never a capability), and a menu with the theme and Sign out, back to the admin
 * sign-in page. Below @5xl only the initials show; on a phone the bar's own theme toggle hides, so
 * the theme is here. The menu keys are the student app's AccountMenu's (useMenuKeys).
 */
export function AdminAccount({ name, role }: { name: string; role: string | null }) {
  const { theme, setChoice } = useThemeChoice()
  const { leave } = useSignOut(ADMIN_SIGNIN_PATH)
  const { open, setOpen, button, menu, onKeyDown } = useMenuKeys()
  const dark = theme === 'dark'

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-label={role ? `Account: ${name}, ${role}` : `Account: ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className="flex min-h-11 cursor-pointer items-center gap-2 border bg-transparent py-0 pr-2.5 pl-1.5 text-foreground hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-expanded:border-accent-700 aria-expanded:bg-accent-100 @max-xl:gap-1 @max-xl:px-1.5"
      >
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center bg-primary-strong font-heading text-caption font-semibold tracking-wide text-primary-strong-foreground"
        >
          {initialsOf(name)}
        </span>
        <span className="whitespace-nowrap @max-5xl:hidden">{name}</span>
        {role ? (
          <span className="font-heading text-overline font-medium tracking-widest whitespace-nowrap text-accent-700 uppercase @max-5xl:hidden">
            {role}
          </span>
        ) : null}
        <ChevronDown aria-hidden="true" strokeWidth={1.5} className="size-icon-sm" />
      </button>

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
            aria-label="Account"
            onKeyDown={onKeyDown}
            className="absolute top-full right-0 z-30 mt-2 flex min-w-56 flex-col border bg-background p-1.5 text-foreground shadow-md motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200"
          >
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
