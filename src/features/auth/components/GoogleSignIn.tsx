'use client'

import { LogIn } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { signIn } from '@/shared/lib/auth/client'
import { SIGNIN_ERROR_PATH } from '@/shared/lib/auth/gate'
import { cn } from '@/shared/lib/utils'
import styles from './sign-in.module.css'

/**
 * The one action that signs in (/): Google. It sits where the design's secondary button does, so
 * it takes the secondary look. `next` must already be a safe path (safeNextPath).
 */
export function GoogleSignIn({ next, className }: { next: string; className?: string }) {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function start() {
    setPending(true)
    setFailed(false)
    try {
      const { error } = await signIn.social({
        provider: 'google',
        callbackURL: next,
        errorCallbackURL: SIGNIN_ERROR_PATH,
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
        <LogIn aria-hidden="true" className="size-3.5" />
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
