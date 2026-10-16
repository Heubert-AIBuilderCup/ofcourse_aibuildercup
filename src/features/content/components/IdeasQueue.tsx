'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Blueprint } from '@/shared/components/Blueprint'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import { type Idea, ideaStartHref, type QueueRow } from '../ideas-queue'
import { postPath } from '../lib/steps'

type Decide = (id: string) => Promise<ActionResult<{ href: string | null }>>

const overline = 'text-overline text-muted-foreground uppercase'
const link = 'text-accent-700 underline-offset-4 hover:underline'

/**
 * The Ideas queue (ADR-042): each suggestion in one row, its tag, title, evidence and where it came
 * from; what to make of it; where research would start or who would deliver it; and, for an
 * editor, Accept and Dismiss. A reviewer sees the rows read-only. Accepting a content idea opens
 * New post started from it; dismissing one takes it off the queue.
 */
export function IdeasQueue({
  rows,
  editable,
  accept,
  dismiss,
}: {
  rows: QueueRow[]
  editable: boolean
  accept: Decide
  dismiss: Decide
}) {
  return (
    <div className="@container flex flex-col gap-3">
      <p className="text-caption text-muted-foreground">Suggested ideas (mock)</p>
      {rows.length === 0 ? (
        <p>No ideas waiting.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <IdeaRow
              key={row.idea.id}
              row={row}
              editable={editable}
              accept={accept}
              dismiss={dismiss}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function IdeaRow({
  row: { idea, state },
  editable,
  accept,
  dismiss,
}: {
  row: QueueRow
  editable: boolean
  accept: Decide
  dismiss: Decide
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const titleId = `idea-${idea.id}`
  const event = idea.kind === 'event'

  const decide = (action: Decide) => {
    setError(null)
    startTransition(async () => {
      const res = await action(idea.id)
      if (!res.ok) setError(res.error)
      else if (res.href) router.push(res.href)
      else router.refresh()
    })
  }

  return (
    <Blueprint
      as="li"
      aria-labelledby={titleId}
      className="grid gap-4 p-4 @5xl:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_auto]"
    >
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <span
          className={cn(
            'border px-2 py-0.5 text-overline uppercase',
            idea.group === 'expansion'
              ? 'border-primary-strong bg-primary-strong text-primary-strong-foreground'
              : 'text-muted-foreground',
          )}
        >
          {`${idea.group} · ${idea.kind}`}
        </span>
        <h2 id={titleId} className="text-h4">
          {idea.title}
        </h2>
        <p className="text-caption">{idea.evidence}</p>
        <p className="text-caption text-muted-foreground">From: {idea.from}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <p className={overline}>Suggested</p>
        <p>{idea.suggested.format}</p>
        <p className="text-caption text-muted-foreground">{idea.suggested.destination}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <p className={overline}>{event ? 'Delivered by' : 'Candidate sources'}</p>
        <ul className="flex flex-col gap-1">
          {(idea.deliveredBy ?? idea.sources ?? []).map((s) => (
            <li key={s} className="text-caption">
              — {s}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex min-w-0 flex-col items-start gap-2 @5xl:items-end">
        {state ? (
          <Accepted idea={idea} postId={state.postId} />
        ) : (
          editable && (
            <>
              <Button size="sm" disabled={pending} onClick={() => decide(accept)}>
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => decide(dismiss)}
              >
                Dismiss
              </Button>
            </>
          )
        )}
        {error && (
          <p role="alert" className="text-caption text-destructive">
            {error}
          </p>
        )}
      </div>
    </Blueprint>
  )
}

/** An accepted idea: its post, the way to start it, or for an expansion idea, passed on. */
function Accepted({ idea, postId }: { idea: Idea; postId: string | null }) {
  if (idea.group === 'expansion') {
    return <p className="text-caption">Accepted · passed to the team</p>
  }
  return (
    <p className="text-caption">
      Accepted ·{' '}
      {postId ? (
        <Link href={postPath(postId)} className={link}>
          Open the post
        </Link>
      ) : (
        <Link href={ideaStartHref(idea)} className={link}>
          Start the post
        </Link>
      )}
    </p>
  )
}
