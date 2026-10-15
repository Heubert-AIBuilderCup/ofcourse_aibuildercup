'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import type { ActionResult } from '@/shared/types/action-result'
import type { RoadmapChoices } from '@/shared/types/student'
import type { RoadFocus } from '../components/PhoneRoad'
import type { BoardRoadmap } from '../components/RoadBoard'
import { pressTile, primaryAction } from '../model/press'
import { type Road, STOP_NAMES, type Stop } from '../model/road-data'
import { type RoadState, serializeRoadState, type View } from '../model/road-url'
import type { RoadPanel } from '../model/routes'
import { buildScene, choicesFrom, type Scene, type Session, sessionFrom } from '../model/scene'
import { useBoardPath } from './useBoardPath'
import { useRoadUrl } from './useRoadUrl'

/** Keeps a board's choices on its roadmap (saveChoicesAction, passed down by the layout). */
export type SaveChoices = (id: string, choices: RoadmapChoices) => Promise<ActionResult>

/** A toast: what an action did, and the session Undo goes back to (none: no Undo). */
export type ToastState = { id: number; text: string; undo: Session | null }

const nameIn = (scene: Scene, id: string) => scene.tiles.find((t) => t.id === id)?.name ?? ''

/**
 * What she does on the board, and where it leaves the URL. The query holds the open tile, the
 * zoom, the view and the stack's list (useRoadUrl); over the lesson or a route step (`panel`), a
 * change to any of them leaves the panel for the board (useBoardPath) with that query. What she
 * changes (swaps, Put on my board, the lesson read, a walk) starts from the roadmap's stored
 * choices, is said in a toast with Undo, and is saved to the roadmap, a change and its Undo alike;
 * a save that fails leaves the change on screen and says so (`saveFailed`) until one succeeds. Her
 * first visit (the server's say) is the first arrival, never saved. Zoom changes, presses and the
 * view are said in `status`, for a polite live region. The list and the lesson opened from the
 * board pushed an entry, so closing them goes back.
 */
export function useRoadSession(
  road: Road,
  panel: RoadPanel,
  roadmap: BoardRoadmap,
  saveChoicesAction: SaveChoices,
) {
  const router = useRouter()
  const board = useBoardPath()
  const [session, setSession] = useState<Session>(() =>
    sessionFrom(roadmap.choices, roadmap.firstVisit),
  )
  const scene = useMemo(() => buildScene(road, session), [road, session])
  const { state, setState } = useRoadUrl(scene.tiles)
  const [status, setStatus] = useState('')
  const [toast, setToast] = useState<ToastState | null>(null)
  const toasts = useRef(0)
  // What just changed, for the phone's road to scroll to.
  const [changed, setChanged] = useState<RoadFocus | null>(null)
  const listPushed = useRef(false)
  const lessonPushed = useRef(false)
  const [saveFailed, setSaveFailed] = useState(false)

  /** Any press ends the first arrival, and its hint. */
  const settled = session.first ? { ...session, first: false } : session

  // The saves sent so far, one after another.
  const saving = useRef<Promise<void>>(Promise.resolve())

  /**
   * The board has already changed; a failure only says so. Each save waits for the one before, so
   * they land in the order she made them (an Undo never lands before its change) and the last
   * one's answer is the one shown.
   */
  function save(next: Session) {
    const choices = choicesFrom(next)
    saving.current = saving.current.then(() =>
      saveChoicesAction(roadmap.id, choices).then(
        (result) => setSaveFailed(!result.ok),
        () => setSaveFailed(true),
      ),
    )
  }

  /**
   * A new session, said in a toast; with Undo unless it says otherwise. `focus`: the tile that
   * changed, for the phone's road to bring into view (where she is by default).
   */
  function change(
    next: Session,
    text: (after: Scene) => string,
    { undo = true, focus }: { undo?: boolean; focus?: string } = {},
  ) {
    const after = buildScene(road, next)
    toasts.current += 1
    setToast({ id: toasts.current, text: text(after), undo: undo ? session : null })
    setChanged({ tileId: focus ?? after.here })
    setSession(next)
    save(next)
  }

  /** The board's next state; over the lesson or a route step, it leaves them for the board. */
  function go(next: RoadState) {
    if (!panel) return setState(next)
    lessonPushed.current = false
    const query = serializeRoadState(next)
    router.replace(query ? `${board}?${query}` : board)
  }

  function press(tileId: string) {
    setSession(settled)
    const base = settled === session ? scene : buildScene(road, settled)
    go(pressTile(state, tileId, base))
    setStatus(
      tileId === base.here
        ? `Back to where you are: ${nameIn(base, tileId)}`
        : `${nameIn(base, tileId)} open in the card.`,
    )
  }

  function zoom(stop: Stop) {
    if (session.first) setSession(settled)
    if (stop === state.zoom) return
    go({ ...state, zoom: stop })
    setStatus(`Zoom: ${STOP_NAMES[stop]}`)
  }

  function close() {
    go({ ...state, tile: null, open: null })
    setStatus('Back to where you are')
  }

  function view(next: View) {
    if (next === state.view) return
    go({ ...state, view: next })
    setStatus(next === 'map' ? 'Map view' : 'Road view')
  }

  function back(tileId: string) {
    setSession(settled)
    go({ ...state, tile: tileId, zoom: 'level', open: null })
    setStatus(`${nameIn(scene, tileId)} open in the card.`)
  }

  function primary() {
    const action = primaryAction(road, scene, state.tile)
    if (!action) return
    if (action.kind === 'look') return press(action.tileId)
    if (action.kind === 'list') {
      listPushed.current = true
      return setState({ ...state, open: 'list' })
    }
    if (action.kind === 'swap') {
      change(
        { ...settled, swapped: !settled.swapped },
        (after) =>
          `${nameIn(after, after.here)} is on your road now. The road ahead re-routed through it.`,
      )
    } else {
      change(
        { ...settled, city: action.to === 'city', country: action.to === 'country' },
        (after) => `Walked to ${nameIn(after, after.here)}`,
      )
    }
    go({ ...state, tile: null, open: null })
  }

  function closeList() {
    if (listPushed.current) {
      listPushed.current = false
      window.history.back()
    } else setState({ ...state, open: null })
  }

  function put(tileId: string) {
    change(
      { ...settled, added: true },
      (after) =>
        `${nameIn(after, after.alternative)} is on your board, beside your road. ${nameIn(scene, scene.alternative)} folded into the stack.`,
      { focus: tileId },
    )
    closeList()
  }

  /** Off the lesson, back to the board: back in history when the board pushed it. */
  function leaveLesson() {
    if (lessonPushed.current) {
      lessonPushed.current = false
      router.back()
    } else router.replace(board)
  }

  function read() {
    change({ ...settled, read: true }, () => road.lesson.read, {
      undo: false,
      focus: road.lesson.tileIds[0],
    })
    leaveLesson()
  }

  return {
    scene,
    state,
    status,
    toast,
    saveFailed,
    changed,
    press,
    zoom,
    close,
    view,
    back,
    primary,
    closeList,
    put,
    leaveLesson,
    read,
    /** Off a route step's detail, back to the board. */
    leaveRoute: () => router.replace(board),
    /** A lesson link was followed from the board: it pushed an entry. */
    onLesson: () => {
      lessonPushed.current = true
    },
    undo: () => {
      if (!toast?.undo) return
      setSession(toast.undo)
      save(toast.undo)
      setToast(null)
    },
    dismissToast: () => setToast(null),
  }
}
