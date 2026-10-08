'use client'

import { LogIn } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import type { Surface } from '@/shared/lib/auth/access'
import { signIn } from '@/shared/lib/auth/client'
import { cn } from '@/shared/lib/utils'
import styles from './sign-in.module.css'

/**
 * Google sign-in on a sign-in page. It sits where the design's secondary button does, so it takes
 * the secondary look. `surface` names the page, which the server keeps in the OAuth state so the
 * callback applies that page's rules; a refused or failed sign-in lands on `errorCallbackURL`.
 * `next` must already be a safe path (safeNextPath).
 */
export function GoogleSignIn({
  next,
  surface,
  errorCallbackURL,
  className,
}: {
  next: string
  surface: Surface
  errorCallbackURL: string
  className?: string
}) {
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

  return (
    <div className={cn(styles.rise, styles.d8, 'grid gap-2', className)}>
      <Button
        variant="outline"
        size="lg"
        disabled={pending}
        onClick={() => void start()}
        className={cn(styles.frame, styles.spread, 'w-full bg-transparent')}
      >
        <LogIn aria-hidden="true" className="size-icon-sm" />
        Continue with Google
      </Button>
      {failed ? (
        <p className="text-sm text-destructive" role="alert">
          Sign-in did not start. Try again.
        </p>
      ) : null}
    </div>
  )
}
