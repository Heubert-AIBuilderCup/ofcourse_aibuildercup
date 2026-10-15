'use client'

import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type MouseEvent, useEffect, useRef, useState } from 'react'
import { Toast } from '@/shared/components/Toast'
import { Button } from '@/shared/components/ui/button'
import { ROADMAPS_PATH, roadmapPath } from '@/shared/lib/student-paths'
import type { ActionResult } from '@/shared/types/action-result'
import type { RoadmapSummary } from '../model/roadmap'
import { DeleteDialog } from './DeleteDialog'
import { NewRoadmapDialog } from './NewRoadmapDialog'
import { RenameDialog } from './RenameDialog'
import { RoadmapCard } from './RoadmapCard'

const LEAD =
  'Each roadmap is one set of answers and the road it draws. Copy one and change a few answers to see another way.'
const FIRST_LEAD =
  'Your first roadmap is ready. Open it to explore, or make another with different answers.'
const READY = 'Your new roadmap is ready.'

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
}

/**
 * "Your roadmaps": the title and its lead (the first-visit line while her one roadmap has never
 * been opened), New roadmap, a card per roadmap in the order given (never ranked), and the
 * footnote. The list is the server's, with what she did here since on top: renamed and deleted
 * cards (Undo puts a card back in its place); a reload reads the server again. Each dialog gives
 * focus back to the button that opened it, or to the title when that button went with its card.
 * Arriving from the loader with a new roadmap (`madeId`), a toast says it is ready, with Open it;
 * the address drops `?made=` at once, so a reload does not say it again.
 */
export function RoadmapsPage({
  roadmaps,
  madeId,
  renameRoadmapAction,
  deleteRoadmapAction,
  restoreRoadmapAction,
  startFromScratchAction,
}: RoadmapsPageProps) {
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())
  const [names, setNames] = useState<Readonly<Record<string, string>>>({})
  const [dialog, setDialog] = useState<DialogKind | null>(null)
  // Kept after its dialog closes, so the closing dialog still has its name.
  const [targetId, setTargetId] = useState<string | null>(null)
  const router = useRouter()
  const [toast, setToast] = useState<ToastState | null>(() =>
    madeId ? { key: 0, text: READY, onOpen: () => router.replace(roadmapPath(madeId)) } : null,
  )
  const heading = useRef<HTMLHeadingElement>(null)
  const returnTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (madeId) window.history.replaceState(null, '', ROADMAPS_PATH)
  }, [madeId])

  const shown = roadmaps
    .filter((r) => !removed.has(r.id))
    .map((r) => (names[r.id] ? { ...r, name: names[r.id] } : r))
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

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-section px-gutter py-section">
      <div className="flex flex-wrap items-end justify-between gap-6 @max-xl:flex-col @max-xl:items-stretch">
        <div className="flex max-w-2xl flex-col gap-3">
          <h1
            ref={heading}
            tabIndex={-1}
            className="m-0 font-heading text-h1 font-semibold focus:outline-none"
          >
            Your roadmaps
          </h1>
          <p className="m-0 text-lead text-muted-foreground">{firstVisit ? FIRST_LEAD : LEAD}</p>
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

      <ul
        aria-label="Your roadmaps, last opened first"
        className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(22rem,100%),1fr))] gap-6 p-0"
      >
        {shown.map((r) => (
          <RoadmapCard
            key={r.id}
            roadmap={r}
            canDelete={shown.length > 1}
            onRename={(opener) => open('rename', r.id, opener)}
            onDelete={(opener) => open('delete', r.id, opener)}
          />
        ))}
      </ul>

      <p className="m-0 text-caption text-muted-foreground">
        Roadmaps are never ranked. Each shows where one set of answers leads.
      </p>

      <NewRoadmapDialog
        open={dialog === 'new'}
        roadmaps={shown}
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
