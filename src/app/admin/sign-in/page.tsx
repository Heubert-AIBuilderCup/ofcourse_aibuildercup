import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { GoogleSignIn } from '@/features/auth/components/GoogleSignIn'
import { SignInPanel } from '@/features/auth/components/SignInPanel'
import styles from '@/features/auth/components/sign-in.module.css'
import { Blueprint } from '@/shared/components/Blueprint'
import motion from '@/shared/components/motion.module.css'
import { ThemeToggle } from '@/shared/components/ThemeToggle'
import { canSeeBoard } from '@/shared/lib/auth/access'
import {
  ADMIN_PATH,
  ADMIN_SIGNIN_ERROR_PATH,
  adminHome,
  isAdminPath,
  SIGNIN_MESSAGES,
  safeNextPath,
} from '@/shared/lib/auth/gate'
import { getSession } from '@/shared/lib/auth/session'
import { HEADER_ACTION_SIGNIN_SPOT } from '@/shared/lib/header-action'
import { SITE_NAME } from '@/shared/lib/site'
import { cn } from '@/shared/lib/utils'

export const metadata: Metadata = {
  title: `Admin sign-in · ${SITE_NAME}`,
  robots: { index: false },
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/**
 * Public: the admin sign-in page, outside the admin console's admin-only layout (the proxy lets it
 * through). The sign-in page's Industry layout, with Google as the only way in: the hooks refuse an
 * account without admin access, which comes back here with its message. Signed in as staff (an
 * admin, a superadmin, an editor or a reviewer): on to the admin page asked for, else the admin.
 * Signed in as a student: the page, since a student session is no admin session.
 */
export default async function AdminSignInPage({ searchParams }: PageProps<'/admin/sign-in'>) {
  const [params, session] = await Promise.all([searchParams, getSession()])
  // Only an admin page of this app, never another origin (gate.ts).
  const asked = safeNextPath(first(params.next))
  const askedAdmin = asked && isAdminPath(asked) ? asked : null
  // Signed in, in one hop: the page asked for, else this account's admin home.
  if (session && canSeeBoard(session.user)) redirect(askedAdmin ?? adminHome(session.user))
  // After Google the account is not yet known, so /admin picks its home.
  const next = askedAdmin ?? ADMIN_PATH
  // Only this page's two messages; anything else in the URL is ignored, never echoed.
  const error = first(params.error)
  const message = error === 'signin' || error === 'not-admin' ? SIGNIN_MESSAGES[error] : null

  return (
    // The outer div is the container the layout queries; a container query never applies to the
    // container itself, so the grid is a separate child.
    <div className={cn(motion.page, '@container min-h-dvh bg-background text-foreground')}>
      <div className="split-page relative min-h-dvh @max-5xl:grid-cols-1 @max-5xl:grid-rows-[auto_1fr]">
        <SignInPanel
          productName={`${SITE_NAME} Admin`}
          lede={`Content, reviews and accounts for ${SITE_NAME}.`}
        />
        {/* The header action (the design's .hdr): on the page side by side, in the band below. */}
        <ThemeToggle className={HEADER_ACTION_SIGNIN_SPOT} />

        <main className="flex flex-col items-center justify-center gap-stack px-6 py-12 dark:@5xl:split-divider-x dark:@max-5xl:split-divider-y @max-5xl:justify-start @max-5xl:px-10 @max-5xl:pb-14 @max-xl:gap-5 @max-xl:px-4 @max-xl:pt-7 @max-xl:pb-9">
          <Blueprint
            className={cn(
              styles.frame,
              styles.cardFrame,
              'flex w-full max-w-sm flex-col gap-5 bg-card p-stack text-card-foreground @max-xl:p-5',
            )}
          >
            <div className={cn(motion.rise, motion.d6)}>
              <div className="mb-[0.425rem] text-micro uppercase text-primary-strong">
                Admin sign-in
              </div>
              <h2 className="m-0 mb-[0.425rem] font-heading text-h2 font-semibold tracking-[-0.015em]">
                Sign in
              </h2>
              <p className="m-0 text-sm text-muted-foreground">Use your Google account.</p>
            </div>

            {message ? (
              <p className="text-sm text-destructive" role="alert">
                {message}
              </p>
            ) : null}

            <GoogleSignIn next={next} surface="admin" errorCallbackURL={ADMIN_SIGNIN_ERROR_PATH} />
          </Blueprint>

          <div
            className={cn(
              motion.rise,
              motion.d8,
              'flex justify-center text-caption text-muted-foreground',
            )}
          >
            © {new Date().getFullYear()} {SITE_NAME}
          </div>
        </main>
      </div>
    </div>
  )
}
