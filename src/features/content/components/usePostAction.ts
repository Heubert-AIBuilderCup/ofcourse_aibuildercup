'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { Saved } from '../server/commands'

/** What a workbench control says when the action itself could not be reached. */
const NETWORK_ERROR = 'Could not reach the server. Please try again.'

/**
 * Run a post action (src/features/admin/hooks/useAdminAction.ts, for posts): a toast with its
 * outcome, with the note of what will be made again when an edit moved the post back (GD28),
 * then the page refreshed either way, so a "Changed by" refusal loads the latest version.
 * The last refusal stays in `error` until the next run, so the control that ran it can say it
 * beside itself.
 */
export function usePostAction() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const run = (
    action: () => Promise<Saved>,
    success: string,
    onDone?: (r: { id: string; version: number }) => void,
  ) => {
    setError(null)
    startTransition(async () => {
      try {
        const res = await action()
        if (res.ok) {
          // An edit at a passed step says what will be made again (GD28).
          if (res.note) toast.success(success, { description: res.note })
          else toast.success(success)
          onDone?.({ id: res.id, version: res.version })
        } else {
          toast.error(res.error)
          setError(res.error)
        }
      } catch {
        toast.error(NETWORK_ERROR)
        setError(NETWORK_ERROR)
      }
      router.refresh()
    })
  }

  return { pending, run, error }
}
