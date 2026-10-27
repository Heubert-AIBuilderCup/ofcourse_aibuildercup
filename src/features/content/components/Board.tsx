import { Lock, Plus } from 'lucide-react'
import Link from 'next/link'
import { AdminPageHeader } from '@/features/admin'
import { emptyBox } from '@/shared/components/classes'
import motion from '@/shared/components/motion.module.css'
import { buttonVariants } from '@/shared/components/ui/button'
import { canEdit, type Staff } from '@/shared/lib/auth/access'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import {
  ANY_BOARD,
  BOARD_FILTERS,
  type BoardParams,
  type BoardStaff,
  boardHref,
  type boardView,
  columnHeadingId,
  nth,
} from '../lib/board'
import { COLUMNS, GATE_AFTER } from '../model/stages'
import type { AssignInput } from './AssignPost'
import { BoardBand } from './BoardBand'
import { BoardFilters } from './BoardFilters'
import { BoardFirstRun } from './BoardFirstRun'
import { BoardFrame } from './BoardFrame'
import { BoardHighlight, PhoneGate, StageColumn, StageTabs } from './BoardHighlight'
import { BoardItemCard } from './BoardItemCard'
import { BoardMore } from './BoardMore'

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
        <BoardFirstRun editable={editable} />
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
              <StageTabs
                stages={view.columns.map((c) => ({
                  id: c.id,
                  label: c.label,
                  count: c.items.length,
                }))}
                gateAfter={GATE_AFTER}
                gateWhy={GATE_WHY}
              />
              <div className="flex flex-col gap-8 @max-xl:mt-4 @5xl:grid @5xl:grid-cols-[minmax(0,1fr)_auto_repeat(5,minmax(0,1fr))] @5xl:gap-3">
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
          <p className={cn(emptyBox, 'justify-center')}>Nothing here</p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(16rem,100%),1fr))] gap-2.5 @5xl:grid-cols-1">
            {column.items.map((item) => (
              <li
                key={`${item.kind}-${item.id}`}
                className={cn(
                  'relative min-w-0',
                  item.hangs &&
                    '@5xl:ml-4 @5xl:before:absolute @5xl:before:-top-2.5 @5xl:before:-left-2 @5xl:before:h-7 @5xl:before:w-2 @5xl:before:border-b @5xl:before:border-l @5xl:before:border-foreground/35',
                )}
              >
                <BoardItemCard
                  item={item}
                  draft={beforeGate}
                  editable={editable}
                  staff={staff}
                  assign={assign}
                />
              </li>
            ))}
          </ul>
        )}
      </StageColumn>
      {gate && (
        <PhoneGate after={COLUMNS[n + 1].id}>
          <Gate />
        </PhoneGate>
      )}
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
    <div title={GATE_WHY} className="flex flex-1 cursor-help flex-col gap-1.5">
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
