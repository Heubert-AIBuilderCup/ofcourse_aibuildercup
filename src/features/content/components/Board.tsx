import Link from 'next/link'
import { buttonVariants } from '@/shared/components/ui/button'
import { canEdit, type Staff } from '@/shared/lib/auth/access'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import {
  ANY_BOARD,
  BOARD_FILTERS,
  type BoardItem,
  type BoardParams,
  type BoardStaff,
  boardHref,
  type boardView,
} from '../lib/board'
import { CHANGED_LINE } from '../lib/lines'
import { GATE_AFTER } from '../model/stages'
import { type AssignInput, AssignPost } from './AssignPost'
import { BoardFilters } from './BoardFilters'
import { BoardMore } from './BoardMore'
import { reasonText, tag } from './classes'

type BoardProps = {
  view: ReturnType<typeof boardView>
  params: BoardParams
  viewer: Staff
  /** Who a post can be assigned to, for the Assignee filter and the Assign popover. */
  staff: BoardStaff[]
  assign: (input: AssignInput) => Promise<ActionResult>
}

/** The render gate's words, on the dark band after the first column. */
const GATE_TEXT = 'Render gate · crossed by approval only'

/**
 * The board: its title and the segmented tabs, the quiet row of filters, then the whole pipeline
 * in one view, never scrolling sideways. From @5xl the six stages stand side by side, each under a
 * heavy rule, with the render gate a dark vertical band after the first; below it they stack, each
 * stage's cards in a self-sizing grid, the gate a dark horizontal band.
 */
export function Board({ view, params, viewer, staff, assign }: BoardProps) {
  const editable = canEdit(viewer)
  const filtered = hasFilters(params)
  return (
    <div className="@container flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div>
            <h1 className="text-h1 font-semibold tracking-tight">Content board</h1>
            <p className="text-caption text-muted-foreground">
              Feed posts, their social versions, and route comics
            </p>
          </div>
          <nav aria-label="Board filters" className="flex flex-wrap border">
            {BOARD_FILTERS.map((f, i) => (
              <Link
                key={f.id}
                href={boardHref({ ...params, filter: f.id })}
                aria-current={f.id === params.filter ? 'page' : undefined}
                className={cn(
                  'px-3 py-1.5 text-caption whitespace-nowrap',
                  i > 0 && 'border-l',
                  f.id === params.filter
                    ? 'bg-primary-strong text-primary-strong-foreground'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {`${f.label} · ${view.counts[f.id]}`}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editable && (
            <Link href="/admin/posts/new" className={buttonVariants()}>
              + New feed post
            </Link>
          )}
          <BoardMore editable={editable} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <BoardFilters params={params} staff={staff} pages={view.pages} />
        {filtered && (
          <Link
            href={boardHref({ ...ANY_BOARD, filter: params.filter })}
            className="text-caption text-accent-700 underline-offset-4 hover:underline"
          >
            Clear filters
          </Link>
        )}
      </div>

      {view.empty ? (
        <p>Nothing matches these filters</p>
      ) : (
        <div className="flex flex-col gap-6 @5xl:grid @5xl:grid-cols-[minmax(0,1fr)_auto_repeat(5,minmax(0,1fr))] @5xl:gap-3">
          {view.columns.map((column) => (
            <Column
              key={column.id}
              column={column}
              gate={column.id === GATE_AFTER}
              editable={editable}
              staff={staff}
              assign={assign}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** Whether any of the four selects is set; the tab is not a filter here. */
const hasFilters = (params: BoardParams) =>
  (['assignee', 'type', 'page', 'lang'] as const).some((k) => params[k] !== ANY_BOARD[k])

function Column({
  column,
  gate,
  editable,
  staff,
  assign,
}: {
  column: BoardProps['view']['columns'][number]
  /** The render gate stands after this column. */
  gate: boolean
  editable: boolean
  staff: BoardStaff[]
  assign: BoardProps['assign']
}) {
  return (
    <>
      <section
        aria-labelledby={`column-${column.id}`}
        className="flex min-w-0 flex-col gap-3 border-t-2 border-foreground pt-2"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 id={`column-${column.id}`} className="text-overline uppercase">
            {column.label}
          </h2>
          <span className="text-overline">{column.items.length}</span>
        </div>
        {column.items.length === 0 ? (
          <p className="text-caption text-muted-foreground">Nothing here</p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(16rem,100%),1fr))] gap-2 @5xl:grid-cols-1">
            {column.items.map((item) => (
              <li
                key={`${item.kind}-${item.id}`}
                className={cn('min-w-0', item.kind === 'social' && 'pl-3')}
              >
                <Card item={item} editable={editable} staff={staff} assign={assign} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {gate && (
        <div className="flex items-center justify-center bg-foreground px-3 py-2 @5xl:items-end @5xl:px-1.5 @5xl:py-6">
          <span className="text-overline text-warning uppercase @5xl:rotate-180 @5xl:[writing-mode:vertical-rl]">
            {GATE_TEXT}
          </span>
        </div>
      )}
    </>
  )
}

function Card({
  item,
  editable,
  staff,
  assign,
}: {
  item: BoardItem
  editable: boolean
  staff: BoardStaff[]
  assign: BoardProps['assign']
}) {
  return (
    <article className="flex flex-col gap-1 border bg-card p-3 text-card-foreground">
      <p className="text-overline text-muted-foreground uppercase">{item.overline}</p>
      <h3 className="min-w-0 break-words font-heading font-semibold">
        <Link href={item.href} className="underline-offset-4 hover:underline">
          {item.title}
        </Link>
      </h3>
      {item.fromLine && <p className="text-caption text-accent-700">{item.fromLine}</p>}
      <p className="text-caption text-muted-foreground">{item.liveLine ?? item.changedLine}</p>
      {item.linkedLines.length > 0 && (
        <ul className="flex flex-wrap gap-1 pt-1">
          {item.linkedLines.map((line) => (
            <li key={line} className="border border-primary px-1.5 text-caption text-accent-700">
              {line}
            </li>
          ))}
        </ul>
      )}
      {item.changedSincePublished && (
        // Still live for students while it is worked on again (criteria 116, 119).
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className={tag}>Live</span>
          <span className={tag}>Changed</span>
          <span className={reasonText}>{CHANGED_LINE}</span>
        </div>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-x-2 border-t pt-2 text-caption">
        <span className={cn(!item.assigneeId && 'text-muted-foreground')}>
          {item.assigneeId ? (item.assigneeName ?? 'Someone') : 'Unassigned'}
        </span>
        {item.assignmentNote && (
          <span className="min-w-0 break-words text-muted-foreground">{item.assignmentNote}</span>
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
