'use client'

import { ArrowRight, CircleAlert, LoaderCircle } from 'lucide-react'
import { useActionState, useId } from 'react'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'

/** What a story's card shows. */
export type JudgeStoryCard = { id: string; name: string; country: string; line: string }

type Props = {
  /** The judge sign-in action: on success it redirects, so only a refusal comes back. */
  action: (previous: ActionResult | null, form: FormData) => Promise<ActionResult>
  /** The student page's story (one today); without it, the admin page's form, with no choice. */
  stories?: readonly JudgeStoryCard[]
  /** The passcode, said in the dialog and filled in, when the developer chose to show it (18 Oct). */
  passcode?: string
}

// The sign-in form's field: a small label that takes the accent while the field has focus.
const LABEL =
  'text-xs font-normal text-foreground/70 transition-colors group-focus-within:text-primary-strong'
const INPUT =
  'h-9 bg-muted text-sm focus-visible:border-primary focus-visible:ring-offset-0 aria-invalid:border-danger aria-invalid:inset-ring aria-invalid:inset-ring-danger'
const CHOICE =
  'flex cursor-pointer flex-col items-start gap-1 border border-foreground/25 px-4.5 py-4 text-left hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50'

/**
 * "Judge access" under a sign-in form: a small text action that opens the passcode dialog. On the
 * admin page the passcode signs in to the shared admin judge; on the student page it comes with the
 * story offered, its card a way in as a new student with that story. The action answers a wrong
 * passcode, too many tries or a failed sign-in, said in the dialog; a sign-in redirects.
 */
export function JudgeAccess({ action, stories, passcode }: Props) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="text" className="min-h-0 justify-center">
          Judge access
        </Button>
      </DialogTrigger>
      <DialogContent className={cn(stories && 'max-h-dvh max-w-2xl overflow-y-auto')}>
        <JudgeForm action={action} stories={stories} passcode={passcode} />
      </DialogContent>
    </Dialog>
  )
}

/** Inside the dialog's content, so each opening starts with an empty passcode and no message. */
function JudgeForm({ action, stories, passcode }: Props) {
  const id = useId()
  const [state, formAction, pending] = useActionState(action, null)
  const error = state && !state.ok ? state.error : null
  const errorId = `${id}-error`

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="m-0 font-heading text-overline font-medium text-muted-foreground uppercase">
          Judge access
        </p>
        <DialogTitle className="m-0 font-heading text-h3 font-semibold">
          {stories ? 'Try OfCourse as a student' : 'The admin, as a judge'}
        </DialogTitle>
        <DialogDescription className="m-0">
          {stories
            ? 'Enter the passcode from the submission notes, then open her roadmap. Each sign-in makes a new account, so nothing carries over.'
            : 'Enter the passcode from the submission notes. The judge account edits and reviews posts; users and models stay closed.'}
        </DialogDescription>
        {passcode ? (
          <p className="m-0 text-sm">
            The passcode is <strong className="font-semibold">{passcode}</strong>; it is filled in
            for you.
          </p>
        ) : null}
      </div>

      <div className="group flex flex-col gap-1.5">
        <Label htmlFor={`${id}-passcode`} className={LABEL}>
          Passcode
        </Label>
        <Input
          id={`${id}-passcode`}
          name="passcode"
          type={passcode ? 'text' : 'password'}
          defaultValue={passcode}
          autoComplete="off"
          maxLength={200}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={INPUT}
        />
      </div>

      {error ? (
        <div
          role="alert"
          id={errorId}
          className="flex items-start gap-2 border border-danger-300 bg-danger-100 px-3.5 py-2.5 text-caption text-danger-800"
        >
          <CircleAlert
            aria-hidden="true"
            strokeWidth={1.5}
            className="icon-on-line size-icon shrink-0 text-danger-700"
          />
          <span>{error}</span>
        </div>
      ) : null}

      {stories ? (
        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0" disabled={pending}>
          <legend className="mb-3 p-0 text-sm font-medium">Sign in as</legend>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-3">
            {stories.map((s) => (
              <button key={s.id} type="submit" name="story" value={s.id} className={CHOICE}>
                <span className="font-heading text-h4 font-semibold">{s.name}</span>
                <span className="text-caption text-muted-foreground">{s.country}</span>
                <span className="text-sm">{s.line}</span>
              </button>
            ))}
          </div>
        </fieldset>
      ) : (
        <Button type="submit" disabled={pending}>
          Sign in as a judge
          {pending ? (
            <LoaderCircle
              aria-hidden="true"
              strokeWidth={1.5}
              className="size-icon-sm motion-safe:animate-spin"
            />
          ) : (
            <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-icon-sm" />
          )}
        </Button>
      )}
    </form>
  )
}
