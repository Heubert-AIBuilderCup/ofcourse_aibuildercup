import {
  GitBranch,
  Globe,
  type LucideIcon,
  Newspaper,
  NotebookText,
  PanelsTopLeft,
  Share2,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import type { BoardItem, BoardStaff } from '../lib/board'
import { CHANGED_LINE } from '../lib/lines'
import { type AssignInput, AssignPost } from './AssignPost'
import { reasonText, tag } from './classes'

/** The icon beside a card's kicker: what kind of card it is. */
function iconOf(item: BoardItem): LucideIcon {
  if (item.kind === 'social') return Share2
  if (item.kind === 'market') return Globe
  if (item.type === 'comic') return PanelsTopLeft
  if (item.kind === 'blog') return NotebookText
  return Newspaper
}

/**
 * A board card in four lines: the kicker with its type icon, the title, one status line (live, or
 * who changed it last) and its owner, with the count of a feed post's social versions. Before the
 * gate a dashed draft stands where its picture will be. A live card is framed in the accent.
 */
export function BoardItemCard({
  item,
  draft,
  editable,
  staff,
  assign,
}: {
  item: BoardItem
  draft: boolean
  editable: boolean
  staff: BoardStaff[]
  assign: (input: AssignInput) => Promise<ActionResult>
}) {
  const live = item.stage === 'live'
  const Icon = iconOf(item)
  return (
    <article
      className={cn(
        'flex flex-col gap-1.5 border bg-background p-3.5 pt-2.5 text-foreground transition-colors',
        live ? 'border-primary' : 'border-foreground/18 hover:border-foreground/45',
      )}
    >
      {draft && (
        <div
          aria-hidden="true"
          className="mb-1.5 flex h-23 items-center justify-center border border-dashed border-foreground/35 bg-[repeating-linear-gradient(135deg,transparent_0_0.5rem,color-mix(in_oklch,var(--color-foreground)_4%,transparent)_0.5rem_1rem)] text-caption font-medium text-muted-foreground"
        >
          Not rendered yet
        </div>
      )}
      <p className="flex min-w-0 items-center gap-1.5 font-heading text-overline font-medium tracking-widest text-muted-foreground uppercase">
        <Icon
          aria-hidden="true"
          strokeWidth={1.5}
          className="size-icon-sm shrink-0 text-accent-700"
        />
        <span className="min-w-0 truncate">{item.overline}</span>
      </p>
      <h3 className="min-w-0 text-h4 leading-tight font-semibold break-words">
        <Link href={item.href} className="underline-offset-4 hover:underline">
          {item.title}
        </Link>
      </h3>
      {live ? (
        <p className="flex items-baseline gap-1.5 text-caption font-medium text-accent-700">
          <span
            aria-hidden="true"
            className="size-1.75 shrink-0 self-center rounded-full bg-accent-600 motion-safe:animate-pulse"
          />
          <span>
            Live · <span>{item.liveLine ?? item.changedLine}</span>
          </span>
        </p>
      ) : (
        <p className="text-caption text-muted-foreground">{item.changedLine}</p>
      )}
      {item.changedSincePublished && (
        // Still live for students while it is worked on again (criteria 116, 119).
        <div className="flex flex-wrap items-center gap-2">
          <span className={tag}>Live</span>
          <span className={tag}>Changed</span>
          <span className={reasonText}>{CHANGED_LINE}</span>
        </div>
      )}
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
        <span className={cn(item.assigneeId && 'text-foreground')}>
          {item.assigneeId ? (item.assigneeName ?? 'Someone') : 'Unassigned'}
        </span>
        {item.assignmentNote && <span className="min-w-0 break-words">{item.assignmentNote}</span>}
        {item.versions > 0 && (
          <span className="inline-flex items-center gap-1 font-medium whitespace-nowrap text-accent-700">
            <GitBranch aria-hidden="true" strokeWidth={1.5} className="size-icon-xs" />
            {item.versions === 1 ? '1 version' : `${item.versions} versions`}
          </span>
        )}
        {editable && (
          <span className="ml-auto">
            <AssignPost
              // A saved assignment arrives as new props: the popover starts again from it.
              key={`${item.assigneeId}-${item.assignmentNote}`}
              postId={item.id}
              title={item.title}
              assigneeId={item.assigneeId}
              note={item.assignmentNote}
              staff={staff}
              assign={assign}
            />
          </span>
        )}
      </div>
    </article>
  )
}
