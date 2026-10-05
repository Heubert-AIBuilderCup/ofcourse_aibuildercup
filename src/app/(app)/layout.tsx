import Link from 'next/link'
import { after } from 'next/server'
import { SignOutButton } from '@/features/auth/components/SignOutButton'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { canUseAdmin } from '@/shared/lib/auth/access'
import { HOME_PATH } from '@/shared/lib/auth/gate'
import { requireSession } from '@/shared/lib/auth/session'
import { initialsOf } from '@/shared/lib/initials'
import { recordLastSeen } from '@/shared/lib/presence-server'
import { SITE_NAME } from '@/shared/lib/site'

/** The signed-in app: a top bar and the page. */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const { user } = await requireSession()

  // Presence, after the response: one throttled primary-key update, a no-op when fresh.
  after(() => recordLastSeen(user.id))

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link href={HOME_PATH} className="font-semibold">
            {SITE_NAME}
          </Link>
          <div className="flex items-center gap-3">
            {canUseAdmin(user.role) ? (
              <Link
                href="/admin"
                className="text-sm font-medium underline-offset-4 hover:underline"
              >
                Admin
              </Link>
            ) : null}
            <SignOutButton />
            <Avatar className="size-8">
              {user.image ? <AvatarImage src={user.image} alt="" /> : null}
              <AvatarFallback>{initialsOf(user.name)}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-gutter py-section">{children}</main>
    </div>
  )
}
