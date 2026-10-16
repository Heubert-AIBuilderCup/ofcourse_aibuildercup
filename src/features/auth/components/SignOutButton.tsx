'use client'

import { Button } from '@/shared/components/ui/button'
import { SIGNIN_PATH } from '@/shared/lib/auth/gate'
import { useSignOut } from '../hooks/useSignOut'

export function SignOutButton({ redirectTo = SIGNIN_PATH }: { redirectTo?: string }) {
  const { leave, pending } = useSignOut(redirectTo)

  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => void leave()}>
      Sign out
    </Button>
  )
}
