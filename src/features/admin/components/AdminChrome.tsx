import Link from 'next/link'
import type { ReactNode } from 'react'
import { SignOutButton } from '@/features/auth/components/SignOutButton'
import { ADMIN_SIGNIN_PATH } from '@/shared/lib/auth/gate'
import { SITE_NAME } from '@/shared/lib/site'
import { AdminNav } from './AdminNav'

/** The admin's frame: a top bar, the section nav, the page. */
export function AdminChrome({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-4 px-6">
          <Link href="/admin/users" className="font-semibold">
            {SITE_NAME} <span className="text-muted-foreground">Admin</span>
          </Link>
          <SignOutButton redirectTo={ADMIN_SIGNIN_PATH} />
        </div>
      </header>
      <AdminNav />
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
