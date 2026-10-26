'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Staff } from '@/shared/lib/auth/access'
import { cn } from '@/shared/lib/utils'
import { activeSection, sectionsFor } from '../lib/nav'

/**
 * The admin's section tabs, in the bar beside the brand: the tabs this viewer may open, the
 * current one underlined. Below @xl they take their own row under the brand, edge to edge.
 */
export function AdminNav({ viewer }: { viewer: Staff }) {
  const current = activeSection(usePathname())
  return (
    <nav
      aria-label="Admin sections"
      className="flex min-w-0 @max-xl:order-last @max-xl:-mx-4 @max-xl:grow @max-xl:basis-full @max-xl:border-t"
    >
      {/* One row that scrolls sideways when it runs out of room; the tabs never squeeze or wrap. */}
      <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none] @max-xl:px-1 [&::-webkit-scrollbar]:hidden">
        {sectionsFor(viewer).map((s) => {
          const active = s.href === current
          return (
            <li key={s.href} className="flex shrink-0">
              <Link
                href={s.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex items-center px-3 font-medium whitespace-nowrap no-underline transition-colors focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring @max-xl:min-h-11 @max-xl:px-2.5',
                  active
                    ? 'text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-accent-600 @max-xl:after:inset-x-2.5'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {s.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
