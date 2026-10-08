'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { signOut } from '@/shared/lib/auth/client'
import { WELCOME_PATH } from '@/shared/lib/auth/gate'

/**
 * Ends the session on the server (Better Auth clears the cookie), then leaves for `redirectTo`:
 * the sign-in page at / unless told otherwise. Shared by the button and the onboarding menu.
 */
export function useSignOut(redirectTo: string = WELCOME_PATH) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function leave() {
    setPending(true)
    try {
      await signOut()
    } finally {
      router.replace(redirectTo)
      router.refresh()
    }
  }

  return { leave, pending }
}
