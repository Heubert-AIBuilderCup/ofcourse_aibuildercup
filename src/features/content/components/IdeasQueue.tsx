'use client'

import { Check, FileText } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import { type Idea, ideaStartHref, type QueueRow } from '../ideas-queue'
import { postPath } from '../lib/steps'

type Decide = (id: string) => Promise<ActionResult<{ href: string | null }>>

const overline =
  'font-heading text-overline font-medium tracking-widest text-muted-foreground uppercase'
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
      <p className="text-caption text-muted-foreground">{`${rows.length} suggested ${rows.length === 1 ? 'idea' : 'ideas'} (mock)`}</p>
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
    <li
      aria-labelledby={titleId}
      className="grid gap-6 border border-foreground/18 p-5 hover:border-foreground/45 motion-safe:transition-colors @max-xl:gap-4 @max-xl:p-4 @5xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_auto]"
    >
      <div className="flex min-w-0 flex-col items-start gap-2">
        <span
          className={cn(
            'border px-2 py-0.5 font-heading text-overline font-medium tracking-widest uppercase',
            idea.group === 'expansion'
              ? 'border-accent-700 text-accent-700'
              : 'border-foreground/30 text-muted-foreground',
          )}
        >
          {`${idea.group} · ${idea.kind}`}
        </span>
        <h2 id={titleId} className="text-h3 leading-tight font-semibold">
          {idea.title}
        </h2>
        <p>{idea.evidence}</p>
        <p className="text-caption text-muted-foreground">From: {idea.from}</p>
      </div>
      <dl className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(12rem,100%),1fr))] gap-5">
        <div className="flex min-w-0 flex-col gap-1.5">
          <dt className={overline}>Suggested</dt>
          <dd className="flex flex-col gap-1">
            <span className="font-heading text-h4 leading-tight font-semibold">
              {idea.suggested.format}
            </span>
            <span className="text-caption text-muted-foreground">{idea.suggested.destination}</span>
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <dt className={overline}>{event ? 'Delivered by' : 'Candidate sources'}</dt>
          <dd>
            <ul className="flex flex-col gap-1.5">
              {(idea.deliveredBy ?? idea.sources ?? []).map((s) => (
                <li key={s} className="flex items-start gap-1.5 text-caption">
                  <FileText
                    aria-hidden="true"
                    strokeWidth={1.5}
                    className="icon-on-line-sm size-icon-sm shrink-0 text-accent-700"
                  />
                  {s}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
      <div className="flex min-w-28 flex-col items-stretch gap-2 @max-5xl:flex-row @max-5xl:flex-wrap @max-5xl:items-center">
        {state ? (
          <Accepted idea={idea} postId={state.postId} />
        ) : (
          editable && (
            <>
              <Button size="sm" disabled={pending} onClick={() => decide(accept)}>
                <Check aria-hidden="true" strokeWidth={1.5} className="size-icon-sm" />
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
    </li>
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
