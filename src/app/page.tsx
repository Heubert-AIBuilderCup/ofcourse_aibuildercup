import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SignInPanel } from '@/features/auth/components/SignInPanel'
import { StudentSignIn } from '@/features/auth/components/StudentSignIn'
import styles from '@/features/auth/components/sign-in.module.css'
import { canUseAdmin } from '@/shared/lib/auth/access'
import {
  ADMIN_PATH,
  HOME_PATH,
  SIGNIN_MESSAGES,
  safeNextPath,
  WELCOME_PATH,
} from '@/shared/lib/auth/gate'
import { getSession } from '@/shared/lib/auth/session'
import { SITE_NAME } from '@/shared/lib/site'
import { cn } from '@/shared/lib/utils'

export const metadata: Metadata = { title: `Sign in · ${SITE_NAME}` }

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/**
 * Public: the student sign-in page, the Industry login design. The layout follows the page's own
 * width (a container query): above 960px the dark panel is on the left and the framed card on the
 * right; below, the panel is a band on top and the form fills the rest; under 560px both go
 * compact. The splash (root layout) lands on the panel. Signed in: an admin on to the admin, a
 * student on to the page asked for, else the student app's home.
 */
export default async function SignInPage({ searchParams }: PageProps<'/'>) {
  const [params, session] = await Promise.all([searchParams, getSession()])
  // Only a path of this app, never another origin (gate.ts). '/' is this page: it means home.
  const asked = safeNextPath(first(params.next))
  const next = asked && asked !== WELCOME_PATH ? asked : HOME_PATH
  if (session) redirect(canUseAdmin(session.user.role) ? ADMIN_PATH : next)
  // Only this page's two messages; anything else in the URL is ignored, never echoed.
  const error = first(params.error)
  const message = error === 'signin' || error === 'student-only' ? SIGNIN_MESSAGES[error] : null

  return (
    // The outer div is the container the layout queries; a container query never applies to the
    // container itself, so the grid is a separate child.
    <div className={cn(styles.page, '@container min-h-dvh bg-background text-foreground')}>
      <div className="grid min-h-dvh grid-cols-2 @max-[60rem]:grid-cols-1 @max-[60rem]:grid-rows-[auto_1fr]">
        <SignInPanel
          productName={SITE_NAME}
          overline="Student access"
          lede="Three futures from your own answers: what each would give you and cost you."
        />

        {/* The design's form column: 48/24 at desktop, 48/40/56 on a tablet, 28/16/36 on a phone. */}
        <main className="flex flex-col items-center justify-center gap-stack px-6 py-12 @max-[60rem]:justify-start @max-[60rem]:px-10 @max-[60rem]:pb-14 @max-[35rem]:gap-5 @max-[35rem]:px-4 @max-[35rem]:pt-7 @max-[35rem]:pb-9">
          <StudentSignIn next={next} notice={message} />

          <div
            className={cn(
              styles.rise,
              styles.d8,
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
