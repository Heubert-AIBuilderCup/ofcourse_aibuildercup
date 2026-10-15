import Link from 'next/link'
import type { ReactNode } from 'react'
import { SignOutButton } from '@/features/auth/components/SignOutButton'
import { tag } from '@/shared/components/classes'
import { ThemeToggle } from '@/shared/components/ThemeToggle'
import { canSeeBoard, type Staff } from '@/shared/lib/auth/access'
import { ADMIN_SIGNIN_PATH, BOARD_PATH } from '@/shared/lib/auth/gate'
import { SITE_NAME } from '@/shared/lib/site'
import { cn } from '@/shared/lib/utils'
import { AdminNav } from './AdminNav'

/** The model provider the server's AI client was built with, and its Google Cloud project. */
export type AiInUse = { provider: 'fake' | 'vertex'; project: string | null }

function aiLabel({ provider, project }: AiInUse): string {
  if (provider === 'fake') return 'Stand-in AI'
  return project ? `Gemini · ${project}` : 'Gemini'
}

/**
 * The admin's frame: a top bar, the section nav this viewer may open, the page. Every staff
 * account gets Sign out (back to the admin sign-in page), as the student app refuses them all.
 * Staff who see the board also see which AI the server runs, since the server reads it once at
 * start and a changed .env does not show until it restarts.
 */
export function AdminChrome({
  viewer,
  ai,
  children,
}: {
  viewer: Staff
  ai: AiInUse
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-4 px-gutter">
          <Link href={BOARD_PATH} className="font-semibold">
            {SITE_NAME} <span className="text-muted-foreground">Admin</span>
          </Link>
          <div className="flex items-center gap-2">
            {canSeeBoard(viewer) && (
              <span className={cn(tag, 'text-muted-foreground')}>{aiLabel(ai)}</span>
            )}
            <ThemeToggle />
            <SignOutButton redirectTo={ADMIN_SIGNIN_PATH} />
          </div>
        </div>
      </header>
      <AdminNav viewer={viewer} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-gutter py-section">{children}</main>
    </div>
  )
}

/** A page's title and one line on what it is for. */
export function AdminPageHeader({ title, lede }: { title: string; lede: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-h1 font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-prose text-muted-foreground">{lede}</p>
    </div>
  )
}
