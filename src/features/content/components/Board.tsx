import {
  GitBranch,
  Globe,
  Lock,
  type LucideIcon,
  Newspaper,
  NotebookText,
  PanelsTopLeft,
  Plus,
  Share2,
} from 'lucide-react'
import Link from 'next/link'
import { AdminPageHeader } from '@/features/admin'
import { Duck } from '@/shared/components/Duck'
import motion from '@/shared/components/motion.module.css'
import { buttonVariants } from '@/shared/components/ui/button'
import { canEdit, type Staff } from '@/shared/lib/auth/access'
import { SITE_NAME } from '@/shared/lib/site'
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
  columnHeadingId,
} from '../lib/board'
import { CHANGED_LINE } from '../lib/lines'
import { COLUMNS, GATE_AFTER } from '../model/stages'
import { type AssignInput, AssignPost } from './AssignPost'
import { BoardBand } from './BoardBand'
import { BoardFilters } from './BoardFilters'
import { BoardFrame } from './BoardFrame'
import { BoardHighlight, StageColumn } from './BoardHighlight'
import { BoardMore } from './BoardMore'
import { reasonText, tag } from './classes'

type BoardProps = {
  view: ReturnType<typeof boardView>
  params: BoardParams
  viewer: Staff & { name?: string }
  /** Who a post can be assigned to, for the Assignee filter and the Assign popover. */
  staff: BoardStaff[]
  assign: (input: AssignInput) => Promise<ActionResult>
}

/** The render gate's words, on its band after the first column. */
const GATE_TEXT = 'Render gate · crossed by approval only'
const GATE_WHY = 'Only a structure a reviewer has approved can be rendered.'

/** "01" for the first stage. */
const nth = (i: number) => String(i + 1).padStart(2, '0')

/**
 * The board: its page top, the band with the viewer's own posts, the type switch and the filters,
 * then the whole pipeline in one view, never scrolling sideways. From @5xl the six stages stand
 * side by side, numbered and joined as one road, the render gate a locked blue tile on the road
 * after the first with its band below, scrolling inside the board (BoardFrame) under their sticky
 * headers while the page, its title and filters stay put (17 Oct); below it they stack, each
 * stage's cards in a self-sizing grid, the gate a blue horizontal band. With no post at all the
 * board opens on its first run instead.
 */
export function Board({ view, params, viewer, staff, assign }: BoardProps) {
  const editable = canEdit(viewer)
  const filtered = hasFilters(params)
  return (
    <div className="@container flex min-w-0 flex-col gap-6">
      <AdminPageHeader
        kicker="Content"
        title="Content board"
        lede="Feed posts, their social versions, and route comics"
      >
        <BoardMore editable={editable} />
        {editable && (
          <Link
            href="/admin/posts/new"
            className={cn(buttonVariants(), 'h-11 px-5 @max-xl:flex-1')}
          >
            <Plus aria-hidden="true" strokeWidth={1.5} className="size-icon" />
            New feed post
          </Link>
        )}
      </AdminPageHeader>

      {view.noPosts ? (
        <FirstRun editable={editable} />
      ) : (
        <BoardHighlight>
          <BoardBand name={viewer.name} mine={view.mine} params={params} />

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b pb-5 @max-xl:flex-col @max-xl:items-stretch @max-xl:gap-3 @max-xl:pb-4">
            <nav
              aria-label="Board filters"
              className="inline-flex gap-px border border-foreground/30 bg-foreground/30 @max-xl:grid @max-xl:grid-cols-2"
            >
              {BOARD_FILTERS.map((f) => (
                <Link
                  key={f.id}
                  href={boardHref({ ...params, filter: f.id })}
                  aria-current={f.id === params.filter ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-11 items-center justify-center gap-2 px-4 font-medium whitespace-nowrap no-underline transition-colors @max-xl:px-3',
                    f.id === params.filter
                      ? 'bg-primary-strong text-primary-strong-foreground'
                      : 'bg-background text-foreground hover:bg-accent-100',
                  )}
                >
                  {f.label}
                  {/* Heard as "All · 5", seen as the count beside the word. */}
                  <span className="sr-only"> · </span>
                  <span className="font-heading font-semibold opacity-75">{view.counts[f.id]}</span>
                </Link>
              ))}
            </nav>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <BoardFilters params={params} staff={staff} pages={view.pages} />
              {filtered && (
                <Link
                  href={boardHref({ ...ANY_BOARD, filter: params.filter })}
                  className="inline-flex min-h-11 items-center px-1 font-medium text-accent-700 underline underline-offset-3 hover:text-accent-800"
                >
                  Clear filters
                </Link>
              )}
            </div>
          </div>

          {view.empty ? (
            <p>Nothing matches these filters</p>
          ) : (
            <BoardFrame>
              <div className="flex flex-col gap-8 @5xl:grid @5xl:grid-cols-[minmax(0,1fr)_auto_repeat(5,minmax(0,1fr))] @5xl:gap-3">
                {view.columns.map((column, i) => (
                  <Column
                    key={column.id}
                    column={column}
                    n={i}
                    last={i === view.columns.length - 1}
                    gate={column.id === GATE_AFTER}
                    editable={editable}
                    staff={staff}
                    assign={assign}
                  />
                ))}
              </div>
            </BoardFrame>
          )}
        </BoardHighlight>
      )}
    </div>
  )
}

/** Whether any of the four selects is set; the tab is not a filter here. */
const hasFilters = (params: BoardParams) =>
  (['assignee', 'type', 'page', 'lang'] as const).some((k) => params[k] !== ANY_BOARD[k])

/** The road's stretch on a column's header row, reaching halfway into the gaps beside it. */
const ROAD = 'absolute top-3.5 h-0.75 bg-foreground/20 @max-5xl:hidden'

function Column({
  column,
  n,
  last,
  gate,
  editable,
  staff,
  assign,
}: {
  column: BoardProps['view']['columns'][number]
  /** Its place on the road, from 0. */
  n: number
  last: boolean
  /** The render gate stands after this column. */
  gate: boolean
  editable: boolean
  staff: BoardStaff[]
  assign: BoardProps['assign']
}) {
  // Before the gate nothing is rendered yet: each card there shows a dashed draft.
  const beforeGate = n === 0
  const lit = 'bg-background group-data-highlighted:bg-accent-100 motion-safe:transition-colors'
  return (
    <>
      <StageColumn
        id={column.id}
        className="group flex min-w-0 flex-col gap-3 data-highlighted:bg-accent-100 data-highlighted:shadow-[0_0_0_0.5rem_var(--color-accent-100)] motion-safe:transition-[background-color,box-shadow] motion-safe:duration-300"
      >
        {/* Its node, name and count stay at the top of the board's scroll area while its cards pass under. */}
        <div className={cn('relative flex items-center @5xl:sticky @5xl:top-0 @5xl:z-10', lit)}>
          <span
            aria-hidden="true"
            className={cn(
              ROAD,
              n === 0 ? 'left-3.5' : '-left-1.5',
              last ? 'right-0' : '-right-1.5',
            )}
          />
          <span className="relative flex size-7 shrink-0 items-center justify-center border-2 border-foreground bg-background font-heading text-caption font-semibold group-data-highlighted:border-primary-strong group-data-highlighted:bg-primary-strong group-data-highlighted:text-primary-strong-foreground">
            {nth(n)}
          </span>
          <h2
            id={columnHeadingId(column.id)}
            className={cn('relative min-w-0 px-1.5 text-h4 leading-tight font-semibold', lit)}
          >
            {column.label}
          </h2>
          <span
            className={cn(
              'relative ml-auto pl-1.5 font-heading font-semibold text-muted-foreground',
              lit,
            )}
          >
            {column.items.length}
          </span>
        </div>
        <p className="text-caption text-muted-foreground">{column.sub}</p>
        {column.items.length === 0 ? (
          <p className="flex min-h-18 items-center justify-center border border-dashed border-foreground/30 text-caption text-muted-foreground">
            Nothing here
          </p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(16rem,100%),1fr))] gap-2.5 @5xl:grid-cols-1">
            {column.items.map((item, i) => {
              // A social version hangs under its feed post when the post is above it here.
              const hangs =
                item.parentId !== null &&
                column.items.slice(0, i).some((p) => p.id === item.parentId)
              return (
                <li
                  key={`${item.kind}-${item.id}`}
                  className={cn(
                    'relative min-w-0',
                    hangs &&
                      '@5xl:ml-4 @5xl:before:absolute @5xl:before:-top-2.5 @5xl:before:-left-2 @5xl:before:h-7 @5xl:before:w-2 @5xl:before:border-b @5xl:before:border-l @5xl:before:border-foreground/35',
                  )}
                >
                  <Card
                    item={item}
                    draft={beforeGate}
                    editable={editable}
                    staff={staff}
                    assign={assign}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </StageColumn>
      {gate && <Gate />}
    </>
  )
}

/**
 * The render gate: from @5xl a locked tile of the band's blue on the road, sticky with the
 * headers, over a blue band with its words; below it, one horizontal blue band. Why it is locked
 * is its title.
 */
function Gate() {
  return (
    <div title={GATE_WHY} className="flex cursor-help flex-col gap-1.5">
      <div className="relative @5xl:sticky @5xl:top-0 @5xl:z-10 @max-5xl:hidden">
        <span aria-hidden="true" className={cn(ROAD, '-inset-x-1.5')} />
        <div
          data-theme="light"
          className={cn(
            motion.grid,
            'relative flex h-7 w-11 items-center justify-center overflow-hidden text-panel-foreground',
          )}
        >
          <Lock aria-hidden="true" strokeWidth={1.5} className="relative size-icon-md" />
        </div>
      </div>
      <div
        data-theme="light"
        className={cn(
          motion.grid,
          'relative flex flex-1 items-center gap-2 overflow-hidden px-3 py-2.5 text-panel-foreground @5xl:flex-col @5xl:px-0 @5xl:py-4',
        )}
      >
        <Lock
          aria-hidden="true"
          strokeWidth={1.5}
          className="relative size-icon shrink-0 @5xl:hidden"
        />
        <span className="relative font-heading text-overline font-semibold tracking-widest uppercase @5xl:rotate-180 @5xl:[writing-mode:vertical-rl]">
          {GATE_TEXT}
        </span>
      </div>
    </div>
  )
}

/** The icon beside a card's kicker: what kind of card it is. */
function iconOf(item: BoardItem): LucideIcon {
  if (item.kind === 'social') return Share2
  if (item.kind === 'market') return Globe
  if (item.type === 'comic') return PanelsTopLeft
  if (item.kind === 'blog') return NotebookText
  return Newspaper
}

/**
 * A card in four lines: the kicker with its type icon, the title, one status line (live, or who
 * changed it last) and its owner, with the count of a feed post's social versions. Before the gate
 * a dashed draft stands where its picture will be. A live card is framed in the accent.
 */
function Card({
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
  assign: BoardProps['assign']
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

/**
 * The board with no post at all: the blue band with the duck, a way to make the first post (an
 * editor's), and the six stages a post goes through. "Nothing matches these filters" is for a
 * board whose filters hide its posts.
 */
function FirstRun({ editable }: { editable: boolean }) {
  return (
    <section
      data-theme="light"
      aria-labelledby="board-first-run"
      className={cn(
        motion.grid,
        'relative flex flex-col items-center gap-3 overflow-hidden px-8 pt-16 pb-10 text-center text-panel-foreground @max-xl:px-5 @max-xl:pt-10 @max-xl:pb-8',
      )}
    >
      <Duck size="4.5rem" className="relative size-18 -scale-x-100 object-contain drop-shadow-md" />
      <h2
        id="board-first-run"
        className="relative mt-2 text-h1 leading-none font-semibold text-panel-foreground"
      >
        No posts yet.
      </h2>
      <p className="relative text-lead text-panel-foreground dark:text-panel-foreground/78">
        {`Paste a source or a link and ${SITE_NAME} makes the first post.`}
      </p>
      {editable && (
        <Link
          href="/admin/posts/new"
          className="relative mt-3 inline-flex min-h-11 items-center gap-2 bg-panel-foreground px-5 font-heading font-semibold text-panel no-underline hover:bg-accent-100 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-panel-foreground"
        >
          <Plus aria-hidden="true" strokeWidth={1.5} className="size-icon" />
          New feed post
        </Link>
      )}
      <ol
        aria-label="Where a post goes"
        className="relative mt-10 flex flex-wrap justify-center gap-2 @max-xl:mt-7"
      >
        {COLUMNS.map((c, i) => (
          <li
            key={c.id}
            className="inline-flex min-h-9 items-center gap-2 border border-panel-foreground/45 px-3 font-heading font-medium tracking-wide"
          >
            <span className="font-semibold opacity-70">{nth(i)}</span>
            {c.label}
          </li>
        ))}
      </ol>
    </section>
  )
}
