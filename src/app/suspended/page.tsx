import type { Metadata } from 'next'
import { SITE_NAME, SUSPENDED_CONTACT } from '@/shared/lib/site'

export const metadata: Metadata = { title: `Account suspended · ${SITE_NAME}` }

/**
 * Public, outside the proxy's matcher: where a suspended account lands, from a refused Google
 * sign-in (/signin-error) or a session made before the suspension (auth/session.ts). It offers
 * no sign-in, which would only be refused again.
 */
export default function SuspendedPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-3 px-gutter py-section">
      <h1 className="text-h1 font-semibold tracking-tight">This account is suspended</h1>
      <p className="text-muted-foreground">
        You can’t sign in while your account is suspended. If you think this is a mistake, contact{' '}
        {SUSPENDED_CONTACT || SITE_NAME}.
      </p>
    </main>
  )
}
