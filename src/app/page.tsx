import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { GoogleSignIn } from '@/features/auth/components/GoogleSignIn'
import { SignInForm } from '@/features/auth/components/SignInForm'
import { SignInPanel } from '@/features/auth/components/SignInPanel'
import styles from '@/features/auth/components/sign-in.module.css'
import { Blueprint } from '@/shared/components/Blueprint'
import { HOME_PATH, safeNextPath, WELCOME_PATH } from '@/shared/lib/auth/gate'
import { getSession } from '@/shared/lib/auth/session'
import { SITE_NAME } from '@/shared/lib/site'
import { cn } from '@/shared/lib/utils'

export const metadata: Metadata = { title: `Sign in · ${SITE_NAME}` }

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

const link =
  'text-primary-strong underline-offset-[3px] hover:text-primary-strong-hover hover:underline'

/**
 * Public: the sign-in page, from the Industry login design. The layout follows the page's own
 * width (a container query), as the design does: above 960px the dark panel is on the left and the
 * framed card on the right; below, the panel is a band on top and the form fills the rest; under
 * 560px both go compact. Signed in: on to the page asked for, else the dashboard.
 *
 * The design's links (create an account, privacy, terms) point at routes the starter does not
 * have yet; each project adds the pages or removes the links.
 */
export default async function SignInPage({ searchParams }: PageProps<'/'>) {
  const [params, session] = await Promise.all([searchParams, getSession()])
  // Only a path of this app, never another origin (gate.ts). '/' is this page: it means home.
  const asked = safeNextPath(first(params.next))
  const next = asked && asked !== WELCOME_PATH ? asked : HOME_PATH
  if (session) redirect(next)
  const failed = first(params.error) === 'signin'

  return (
    // The outer div is the container the layout queries; a container query never applies to the
    // container itself, so the grid is a separate child.
    <div className={cn(styles.page, '@container min-h-dvh bg-background text-foreground')}>
      <div className="grid min-h-dvh grid-cols-2 @max-[60rem]:grid-cols-1 @max-[60rem]:grid-rows-[auto_1fr]">
        <SignInPanel
          productName={SITE_NAME}
          lede="[One line on what people do in this product once they sign in.]"
        />

        {/* The design's form column: 48/24 at desktop, 48/40/56 on a tablet, 28/16/36 on a phone. */}
        <main className="flex flex-col items-center justify-center gap-stack px-6 py-12 @max-[60rem]:justify-start @max-[60rem]:px-10 @max-[60rem]:pb-14 @max-[35rem]:gap-5 @max-[35rem]:px-4 @max-[35rem]:pt-7 @max-[35rem]:pb-9">
          <Blueprint
            className={cn(
              styles.frame,
              styles.d5,
              'flex w-full max-w-100 flex-col gap-5 bg-card p-stack text-card-foreground @max-[35rem]:p-5',
            )}
          >
            <div className={cn(styles.rise, styles.d6)}>
              <div className="mb-[0.425rem] text-micro uppercase text-primary-strong">Sign in</div>
              <h2 className="m-0 mb-[0.425rem] font-heading text-h2 font-semibold tracking-[-0.015em]">
                Welcome back
              </h2>
              <p className="m-0 text-sm text-muted-foreground">Use your work email and password.</p>
            </div>

            {failed ? (
              <p className="text-sm text-destructive" role="alert">
                Google sign-in did not finish. Try again.
              </p>
            ) : null}

            <SignInForm />
            <GoogleSignIn next={next} />
          </Blueprint>

          <p
            className={cn(styles.rise, styles.d8, 'm-0 text-center text-sm text-muted-foreground')}
          >
            New to {SITE_NAME}?{' '}
            <a href="/sign-up" className={link}>
              Create an account
            </a>
          </p>

          <div
            className={cn(
              styles.rise,
              styles.d8,
              'flex flex-wrap justify-center gap-x-5 gap-y-[0.425rem] text-caption text-muted-foreground',
            )}
          >
            <span>
              © {new Date().getFullYear()} {SITE_NAME}
            </span>
            <a href="/privacy" className="underline-offset-[3px] hover:underline">
              Privacy
            </a>
            <a href="/terms" className="underline-offset-[3px] hover:underline">
              Terms
            </a>
          </div>
        </main>
      </div>
    </div>
  )
}
