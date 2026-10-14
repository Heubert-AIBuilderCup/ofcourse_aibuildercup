import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SignInPanel } from '@/features/auth/components/SignInPanel'
import { StudentSignIn } from '@/features/auth/components/StudentSignIn'
import { signedInLanding } from '@/features/opening'
import { getProfile } from '@/features/opening/server/profile'
import motion from '@/shared/components/motion.module.css'
import { ThemeToggle } from '@/shared/components/ThemeToggle'
import { canUseAdmin } from '@/shared/lib/auth/access'
import {
  ADMIN_HOME,
  HOME_PATH,
  SIGNIN_MESSAGES,
  SIGNIN_PATH,
  safeNextPath,
} from '@/shared/lib/auth/gate'
import { getSession } from '@/shared/lib/auth/session'
import { HEADER_ACTION_SIGNIN_SPOT } from '@/shared/lib/header-action'
import { SITE_NAME } from '@/shared/lib/site'
import { cn } from '@/shared/lib/utils'

export const metadata: Metadata = { title: `Sign in · ${SITE_NAME}` }

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/**
 * Public: the student sign-in page, the Industry login design. The layout follows the page's own
 * width (a container query): from @5xl (64rem) the dark panel is on the left and the framed card on
 * the right; below, the panel is a band on top and the form fills the rest; below @xl (36rem) both
 * go compact; above 120rem both stay in a centred frame while their colours fill (split-page). The
 * splash (root layout) lands on the panel. Signed in, in one redirect: an admin on to the admin, a
 * student on to the page asked for (her road for an onboarding page once she is on it), else where
 * she left off (what /start answers).
 */
export default async function SignInPage({ searchParams }: PageProps<'/'>) {
  const [params, session] = await Promise.all([searchParams, getSession()])
  // Only a path of this app, never another origin (gate.ts). '/' is this page: it means home.
  const asked = safeNextPath(first(params.next))
  const askedFor = asked && asked !== SIGNIN_PATH ? asked : null
  if (session) {
    if (canUseAdmin(session.user.role)) redirect(ADMIN_HOME)
    redirect(signedInLanding(await getProfile(session.user.id), askedFor))
  }
  // After Google, the browser returns to /start, which answers where she left off.
  const next = askedFor ?? HOME_PATH
  // Only this page's two messages; anything else in the URL is ignored, never echoed.
  const error = first(params.error)
  const message = error === 'signin' || error === 'student-only' ? SIGNIN_MESSAGES[error] : null

  return (
    // The outer div is the container the layout queries; a container query never applies to the
    // container itself, so the grid is a separate child.
    <div className={cn(motion.page, '@container min-h-dvh bg-background text-foreground')}>
      <div className="split-page relative min-h-dvh @max-5xl:grid-cols-1 @max-5xl:grid-rows-[auto_1fr]">
        <SignInPanel
          productName={SITE_NAME}
          overline="Student access"
          lede="Three futures from your own answers: what each would give you and cost you."
        />
        {/* The header action (the design's .hdr): on the page side by side, in the band below. */}
        <ThemeToggle className={HEADER_ACTION_SIGNIN_SPOT} />

        {/* The design's form column: 48/24 at desktop, 48/40/56 on a tablet, 28/16/36 on a phone. */}
        <main className="flex flex-col items-center justify-center gap-stack px-6 py-12 dark:@5xl:split-divider-x dark:@max-5xl:split-divider-y @max-5xl:justify-start @max-5xl:px-10 @max-5xl:pb-14 @max-xl:gap-5 @max-xl:px-4 @max-xl:pt-7 @max-xl:pb-9">
          <StudentSignIn next={next} notice={message} />

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
