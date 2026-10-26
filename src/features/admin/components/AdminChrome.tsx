import Link from 'next/link'
import type { ReactNode } from 'react'
import { Duck } from '@/shared/components/Duck'
import { ThemeToggle } from '@/shared/components/ThemeToggle'
import { canSeeBoard, isRole, type Staff } from '@/shared/lib/auth/access'
import { BOARD_PATH } from '@/shared/lib/auth/gate'
import { SITE_NAME } from '@/shared/lib/site'
import { ROLE_LABELS } from '../lib/labels'
import { AdminAccount } from './AdminAccount'
import { AdminNav } from './AdminNav'

/** The model provider the server's AI client was built with, and its Google Cloud project. */
export type AiInUse = { provider: 'fake' | 'vertex'; project: string | null }

function aiLabel({ provider, project }: AiInUse): string {
  if (provider === 'fake') return 'Stand-in AI'
  return project ? `Gemini · ${project}` : 'Gemini'
}

/**
 * The admin's frame: one bar with the brand, the sections this viewer may open, the AI tag, the
 * theme and the account button, then the page. Staff who see the board also see which AI the
 * server runs, since the server reads it once at start and a changed .env does not show until it
 * restarts. Below @5xl the AI tag and the account's name give the tabs room; below @xl the tabs
 * drop to their own row, and the theme moves into the account menu.
 */
export function AdminChrome({
  viewer,
  ai,
  children,
}: {
  viewer: Staff & { name: string }
  ai: AiInUse
  children: ReactNode
}) {
  return (
    <div className="@container flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex min-h-16 max-w-cap items-stretch gap-x-8 px-6 @max-5xl:gap-x-5 @max-5xl:px-4 @max-xl:flex-wrap @max-xl:gap-x-3">
          <Link
            href={BOARD_PATH}
            className="flex shrink-0 items-center gap-2 font-heading text-h4 font-semibold whitespace-nowrap no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring @max-xl:min-h-14"
          >
            <Duck size="1.75rem" eager className="size-7 object-contain @max-xl:size-6" />
            <span>
              {SITE_NAME} <span className="text-accent-700">Admin</span>
            </span>
          </Link>
          <AdminNav viewer={viewer} />
          <div className="ml-auto flex items-center gap-2">
            {canSeeBoard(viewer) && (
              <span className="inline-flex min-h-7 items-center border border-dashed border-foreground/40 px-2.5 text-overline tracking-wider whitespace-nowrap text-muted-foreground uppercase @max-5xl:hidden">
                {aiLabel(ai)}
              </span>
            )}
            <ThemeToggle className="@max-xl:hidden" />
            <AdminAccount
              name={viewer.name}
              role={isRole(viewer.role) ? ROLE_LABELS[viewer.role] : null}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-cap flex-1 flex-col gap-6 px-gutter py-section @max-xl:px-4 @max-xl:pt-5 @max-xl:pb-8">
        {children}
      </main>
    </div>
  )
}
