'use client'

import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type MouseEvent, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Toast } from '@/shared/components/Toast'
import { Button } from '@/shared/components/ui/button'
import { ROADMAPS_PATH, roadmapPath } from '@/shared/lib/student-paths'
import type { ActionResult } from '@/shared/types/action-result'
import { useListView } from '../hooks/useListView'
import {
  lastOpenedOut,
  orderRoadmaps,
  type RoadmapOrder,
  type RoadmapSummary,
} from '../model/roadmap'
import { ArchivedFold } from './ArchivedFold'
import type { RowActions } from './CardMenu'
import { DeleteDialog } from './DeleteDialog'
import { ListBar } from './ListBar'
import { NewRoadmapDialog } from './NewRoadmapDialog'
import { RenameDialog } from './RenameDialog'
import { RoadmapRow } from './RoadmapRow'
import { RoadmapTable } from './RoadmapTable'

const LEAD =
  'Each roadmap is one set of answers and where it leads. Copy one and change a few answers to see another way.'
const FIRST_LEAD =
  'Your first roadmap is ready. Open it to explore, or make another with different answers.'
const READY = 'Your new roadmap is ready.'
const ARCHIVED = 'Archived. Restore it any time from Archived.'

type DialogKind = 'new' | 'rename' | 'delete'
type ToastState = { key: number; text: string; onUndo?: () => void; onOpen?: () => void }

export type RoadmapsPageProps = {
  /** Hers, last opened first, as the server read them. */
  roadmaps: RoadmapSummary[]
  /** The roadmap the loader just made (`?made=`), one of hers; null when none. */
  madeId: string | null
  renameRoadmapAction: (id: string, name: string) => Promise<ActionResult>
  deleteRoadmapAction: (id: string) => Promise<ActionResult>
  restoreRoadmapAction: (id: string) => Promise<ActionResult>
  startFromScratchAction: () => Promise<ActionResult>
  archiveRoadmapAction: (id: string) => Promise<ActionResult>
  restoreArchivedAction: (id: string) => Promise<ActionResult>
}

/**
 * "Your roadmaps": the count of those out of the archive, the title and its lead (the first-visit
 * line while her one roadmap has never opened), New roadmap; the bar (Sort, and Show as Cards or
 * Table, remembered per browser); her roadmaps as rows or a table, never ranked, the one opened last
 * marked; "Archived (n)" folded at the foot; and the footnote. The list is the server's, with what
 * she did here since on top: renamed, deleted (Undo puts it back in its place), archived and
 * restored; a reload reads the server again. Each dialog gives focus back to the "…" button that
 * opened it, or to the title when that button went with its row; a row that moves to or from the
 * archive leaves focus on the fold, or on the title. Arriving from the loader with a new roadmap
 * (`madeId`), a toast says it is ready, with Open it; the address drops `?made=` at once.
 */
export function RoadmapsPage({
  roadmaps,
  madeId,
  renameRoadmapAction,
  deleteRoadmapAction,
  restoreRoadmapAction,
  startFromScratchAction,
  archiveRoadmapAction,
  restoreArchivedAction,
}: RoadmapsPageProps) {
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())
  const [names, setNames] = useState<Readonly<Record<string, string>>>({})
  // Archived (true) or restored (false) here since the server's list.
  const [archivedNow, setArchivedNow] = useState<Readonly<Record<string, boolean>>>({})
  const [sort, setSort] = useState<RoadmapOrder>('opened')
  const { view, set: setView } = useListView()
  const [dialog, setDialog] = useState<DialogKind | null>(null)
  // Kept after its dialog closes, so the closing dialog still has its name.
  const [targetId, setTargetId] = useState<string | null>(null)
  const router = useRouter()
  const [toast, setToast] = useState<ToastState | null>(() =>
    madeId ? { key: 0, text: READY, onOpen: () => router.replace(roadmapPath(madeId)) } : null,
  )
  const heading = useRef<HTMLHeadingElement>(null)
  const returnTo = useRef<HTMLElement | null>(null)
  const foldToggle = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (madeId) window.history.replaceState(null, '', ROADMAPS_PATH)
  }, [madeId])

  const shown = orderRoadmaps(
    roadmaps
      .filter((r) => !removed.has(r.id))
      .map((r) => ({
        ...r,
        name: names[r.id] ?? r.name,
        archived: archivedNow[r.id] ?? r.archived,
      })),
    sort,
  )
  const active = shown.filter((r) => !r.archived)
  const archived = shown.filter((r) => r.archived)
  const lastOpenedId = lastOpenedOut(shown)?.id ?? null
  const target = shown.find((r) => r.id === targetId) ?? null
  const firstVisit = roadmaps.length === 1 && roadmaps[0].isNew

  function open(kind: DialogKind, id: string | null, opener: HTMLElement | null) {
    returnTo.current = opener
    setTargetId(id)
    setDialog(kind)
  }

  function close(isOpen: boolean) {
    if (!isOpen) setDialog(null)
  }

  function restoreFocus(event: Event) {
    event.preventDefault()
    const to = returnTo.current?.isConnected ? returnTo.current : heading.current
    to?.focus()
  }

  const say = (text: string, onUndo?: () => void) =>
    setToast((was) => ({ key: (was?.key ?? 0) + 1, text, onUndo }))

  async function rename(id: string, name: string): Promise<ActionResult> {
    const result = await renameRoadmapAction(id, name)
    if (result.ok) {
      setNames((was) => ({ ...was, [id]: name.trim() }))
      setDialog(null)
      say('Renamed.')
    }
    return result
  }

  async function undoDelete(id: string) {
    setToast(null)
    const result = await restoreRoadmapAction(id)
    if (!result.ok) return say(result.error)
    setRemoved((was) => new Set([...was].filter((x) => x !== id)))
  }

  async function remove(id: string): Promise<ActionResult> {
    const result = await deleteRoadmapAction(id)
    if (result.ok) {
      setRemoved((was) => new Set(was).add(id))
      setDialog(null)
      say('Roadmap deleted.', () => void undoDelete(id))
    }
    return result
  }

  /**
   * A row moved to or from the archive, its "…" button with it: drawn now, so focus can land on
   * the fold while there is one, else on the title.
   */
  function move(id: string, toArchive: boolean) {
    flushSync(() => setArchivedNow((was) => ({ ...was, [id]: toArchive })))
    ;(foldToggle.current ?? heading.current)?.focus()
  }

  async function undoArchive(id: string) {
    setToast(null)
    const result = await restoreArchivedAction(id)
    if (!result.ok) return say(result.error)
    setArchivedNow((was) => ({ ...was, [id]: false }))
  }

  async function archive(id: string, opener: HTMLElement | null) {
    const result = await archiveRoadmapAction(id)
    if (!result.ok) {
      opener?.focus()
      return say(result.error)
    }
    move(id, true)
    say(ARCHIVED, () => void undoArchive(id))
  }

  async function restore(id: string, opener: HTMLElement | null) {
    const result = await restoreArchivedAction(id)
    if (!result.ok) {
      opener?.focus()
      return say(result.error)
    }
    move(id, false)
    say('Restored.')
  }

  const actions: RowActions = {
    rename: (id, opener) => open('rename', id, opener),
    remove: (id, opener) => open('delete', id, opener),
    archive: (id, opener) => void archive(id, opener),
    restore: (id, opener) => void restore(id, opener),
  }
  const canPutAway = active.length > 1

  const list = (items: RoadmapSummary[], name: string) =>
    view === 'table' ? (
      <RoadmapTable
        caption={name}
        roadmaps={items}
        lastOpenedId={lastOpenedId}
        canPutAway={canPutAway}
        actions={actions}
        sort={sort}
        onSort={setSort}
      />
    ) : (
      <ul
        aria-label={name}
        className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(22rem,100%),1fr))] gap-4 p-0"
      >
        {items.map((r) => (
          <RoadmapRow
            key={r.id}
            roadmap={r}
            on={r.id === lastOpenedId}
            canPutAway={canPutAway}
            actions={actions}
          />
        ))}
      </ul>
    )

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-stack px-gutter py-section">
      <div className="flex flex-wrap items-end justify-between gap-6 @max-xl:flex-col @max-xl:items-stretch">
        <div className="flex max-w-2xl flex-col gap-2">
          <p className="m-0 font-heading text-overline font-medium text-muted-foreground uppercase">
            {active.length} {active.length === 1 ? 'roadmap' : 'roadmaps'}
          </p>
          <h1
            ref={heading}
            tabIndex={-1}
            className="m-0 font-heading text-h1 font-semibold focus:outline-none"
          >
            Your roadmaps
          </h1>
          <p className="m-0 mt-1 text-lead text-muted-foreground">
            {firstVisit ? FIRST_LEAD : LEAD}
          </p>
        </div>
        <Button
          type="button"
          variant="strong"
          size="lg"
          onClick={(event: MouseEvent<HTMLButtonElement>) => open('new', null, event.currentTarget)}
          className="h-12 px-6 text-base"
        >
          <Plus aria-hidden="true" strokeWidth={1.5} className="size-icon" />
          New roadmap
        </Button>
      </div>

      <ListBar sort={sort} onSort={setSort} view={view} onView={setView} />

      {list(active, 'Your roadmaps')}

      {archived.length > 0 ? (
        <ArchivedFold count={archived.length} toggle={foldToggle}>
          {list(archived, 'Archived roadmaps')}
        </ArchivedFold>
      ) : null}

      <p className="m-0 text-caption text-muted-foreground">
        Roadmaps are never ranked. Each one shows where one set of answers leads.
      </p>

      <NewRoadmapDialog
        open={dialog === 'new'}
        roadmaps={active}
        onOpenChange={close}
        startFromScratchAction={startFromScratchAction}
        onCloseAutoFocus={restoreFocus}
      />
      {target ? (
        <>
          <RenameDialog
            open={dialog === 'rename'}
            name={target.name}
            onOpenChange={close}
            onSave={(name) => rename(target.id, name)}
            onCloseAutoFocus={restoreFocus}
          />
          <DeleteDialog
            open={dialog === 'delete'}
            name={target.name}
            onOpenChange={close}
            onConfirm={() => remove(target.id)}
            onCloseAutoFocus={restoreFocus}
          />
        </>
      ) : null}

      {toast ? (
        <Toast
          key={toast.key}
          text={toast.text}
          onUndo={toast.onUndo}
          onOpen={toast.onOpen}
          onDone={() => setToast(null)}
          place="fixed bottom-6"
        />
      ) : null}
    </div>
  )
}
