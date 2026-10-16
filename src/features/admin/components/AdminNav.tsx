'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Staff } from '@/shared/lib/auth/access'
import { cn } from '@/shared/lib/utils'
import { activeSection, sectionsFor } from '../lib/nav'

/** The admin's section nav: the tabs this viewer may open, the current one underlined. */
export function AdminNav({ viewer }: { viewer: Staff }) {
  const current = activeSection(usePathname())
  return (
    <nav aria-label="Admin sections" className="border-b bg-background">
      {/* One row that scrolls sideways on a phone; the tabs never squeeze or wrap. */}
      <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-gutter">
        {sectionsFor(viewer).map((s) => {
          const active = s.href === current
          return (
            <li key={s.href} className="shrink-0">
              <Link
                href={s.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex h-12 items-center whitespace-nowrap border-b-2 px-3 text-caption font-medium no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  active
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
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
