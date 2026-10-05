'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'

type Result = { ok: true } | { ok: false; error: string }

/** What every admin control says when the action itself could not be reached. */
export const NETWORK_ERROR = 'Could not reach the server. Please try again.'

/** Run an admin action: a toast with its outcome, and the page's data refreshed on success. */
export function useAdminAction() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const run = <R extends Result>(
    action: () => Promise<R>,
    success: string | ((r: Extract<R, { ok: true }>) => string),
    onDone?: () => void,
  ) => {
    startTransition(async () => {
      try {
        const res = await action()
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        const ok = res as Extract<R, { ok: true }>
        toast.success(typeof success === 'string' ? success : success(ok))
        onDone?.()
        router.refresh()
      } catch {
        toast.error(NETWORK_ERROR)
      }
    })
  }

  return { pending, run }
}
