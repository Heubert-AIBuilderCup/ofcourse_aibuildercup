import Link from 'next/link'
import { after } from 'next/server'
import { SignOutButton } from '@/features/auth/components/SignOutButton'
import { ThemeToggle } from '@/shared/components/ThemeToggle'
import { isStudent } from '@/shared/lib/auth/access'
import { ADMIN_SIGNIN_PATH, BOARD_PATH, FEED_PATH, HOME_PATH } from '@/shared/lib/auth/gate'
import { requireAppPage } from '@/shared/lib/auth/session'
import { recordLastSeen } from '@/shared/lib/presence-server'
import { SITE_NAME } from '@/shared/lib/site'

/**
 * The feed: every signed-in account that is not suspended, students and staff alike (criterion 71,
 * ADR-121); the student app's layout would send staff to the admin. A slim top bar, phone-first:
 * the site name back to the account's own home (the student app, or the Board for staff), the
 * theme and Sign out to the sign-in page the account uses.
 */
export default async function FeedLayout({ children }: LayoutProps<'/'>) {
  const { user } = await requireAppPage(FEED_PATH)
  const student = isStudent(user)

  // Presence, after the response: one throttled primary-key update, a no-op when fresh.
  after(() => recordLastSeen(user.id))

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-4 px-gutter">
          <Link href={student ? HOME_PATH : BOARD_PATH} className="font-heading font-semibold">
            {SITE_NAME}
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SignOutButton redirectTo={student ? undefined : ADMIN_SIGNIN_PATH} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-gutter py-section">{children}</main>
    </div>
  )
}
