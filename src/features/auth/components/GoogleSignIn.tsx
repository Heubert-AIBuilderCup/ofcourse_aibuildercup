'use client'

import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import motion from '@/shared/components/motion.module.css'
import { Button } from '@/shared/components/ui/button'
import type { Surface } from '@/shared/lib/auth/access'
import { signIn } from '@/shared/lib/auth/client'
import { cn } from '@/shared/lib/utils'
import styles from './sign-in.module.css'

export type GoogleTarget = {
  /** Where she lands after Google; must already be a safe path (safeNextPath). */
  next: string
  /** The page signing in, kept in the OAuth state so the callback applies its rules. */
  surface: Surface
  /** Where a refused or failed sign-in lands. */
  errorCallbackURL: string
}

/**
 * Starting Google sign-in from a page: `start` sends the browser to Google, `pending` while it is
 * leaving (the control stays disabled, as the page is already going), `failed` when it did not
 * start. Google's own message never shows: the page says what to do.
 */
export function useGoogleSignIn({ next, surface, errorCallbackURL }: GoogleTarget) {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function start() {
    setPending(true)
    setFailed(false)
    try {
      const { error } = await signIn.social({
        provider: 'google',
        callbackURL: next,
        errorCallbackURL,
        additionalData: { surface },
      })
      if (error) throw error
      // On success the browser is already leaving for Google: keep the button disabled.
    } catch {
      setFailed(true)
      setPending(false)
    }
  }

  return { start, pending, failed }
}

export type GoogleRun = ReturnType<typeof useGoogleSignIn>

/** Google's "G", from its sign-in branding, on the white tile the guidelines ask for. */
function GoogleMark() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-xs bg-white"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-icon-sm">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    </span>
  )
}

/**
 * Google sign-in on a sign-in page, with Google's mark. It sits where the design's secondary
 * button does, so it takes the secondary look; as the only way in (`primary`) it takes the
 * design's primary button, blue with the arrow. A page with a second control for the same sign-in
 * passes its one `run` (useGoogleSignIn), so both share the pending and failed state.
 */
export function GoogleSignIn({
  primary = false,
  run,
  className,
  ...target
}: GoogleTarget & { primary?: boolean; run?: GoogleRun; className?: string }) {
  const own = useGoogleSignIn(target)
  const { start, pending, failed } = run ?? own

  return (
    <div className={cn(motion.rise, motion.d8, 'grid gap-2', className)}>
      <Button
        variant={primary ? 'strong' : 'outline'}
        size="lg"
        disabled={pending}
        onClick={() => void start()}
        className={cn(styles.frame, styles.spread, 'w-full', !primary && 'bg-transparent')}
      >
        <GoogleMark />
        Sign in with Google
        {primary ? <ArrowRight aria-hidden="true" className="size-icon-sm" /> : null}
      </Button>
      {failed ? (
        <p className="text-sm text-destructive" role="alert">
          Sign-in did not start. Try again.
        </p>
      ) : null}
    </div>
  )
}
