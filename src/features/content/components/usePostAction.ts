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

/**
 * Which press a run is for, beside the `pending` of whatever runs it (usePressedAction's
 * usePostAction, or a screen's own transition): `mark(press)` as it starts, then `pressed(press)`
 * holds for that press until the run ends, and `current` is the press running (null when none
 * is), for a press that carries more than its name (a slide, a chip). `last` is the last run's
 * press, kept after it ends, so the control whose refusal shows can say it beside itself.
 */
export function usePress<P extends string | object>(pending: boolean) {
  const [press, setPress] = useState<P | null>(null)
  const current = pending ? press : null
  const pressed = (control: P) => current !== null && current === control
  return { mark: setPress, pressed, current, last: press }
}

/** What a pressed run is told besides its work: what follows success, and the press it runs for. */
export type PressOptions<P> = {
  onDone?: (r: { id: string; version: number }) => void
  /** The control pressed, as the step names its controls; none for a press no control waits on. */
  press?: P
}

/**
 * usePostAction with the press each run is for (usePress), so only the control pressed shows its
 * spinner and words while it runs: `run(work, done, { onDone, press })`, then `pressed(press)`,
 * `current` and `last` as usePress gives them; `error` is the last run's refusal.
 */
export function usePressedAction<P extends string | object>() {
  const { pending, run: runPost, error } = usePostAction()
  const { mark, pressed, current, last } = usePress<P>(pending)
  const run = (action: () => Promise<Saved>, success: string, options: PressOptions<P> = {}) => {
    mark(options.press ?? null)
    runPost(action, success, options.onDone)
  }
  return { pending, run, error, pressed, current, last }
}
