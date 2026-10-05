'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { signOut } from '@/shared/lib/auth/client'
import { WELCOME_PATH } from '@/shared/lib/auth/gate'

/** Ends the session on the server (Better Auth clears the cookie), then leaves the app. */
export function SignOutButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function leave() {
    setPending(true)
    try {
      await signOut()
    } finally {
      router.replace(WELCOME_PATH)
      router.refresh()
    }
  }

  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => void leave()}>
      Sign out
    </Button>
  )
}
