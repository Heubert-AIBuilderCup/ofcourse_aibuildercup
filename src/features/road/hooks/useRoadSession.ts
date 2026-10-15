'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import type { ActionResult } from '@/shared/types/action-result'
import type { RoadmapChoices, StoredAnswers } from '@/shared/types/student'
import type { RoadFocus } from '../components/PhoneRoad'
import type { BoardRoadmap } from '../components/RoadBoard'
import { pressTile, primaryAction } from '../model/press'
import { type Road, STOP_NAMES, type Stop } from '../model/road-data'
import { type RoadState, serializeRoadState, type View } from '../model/road-url'
import type { RoadPanel } from '../model/routes'
import {
  buildScene,
  choicesFrom,
  POINT_A,
  type Scene,
  type Session,
  sessionFrom,
} from '../model/scene'
import { useBoardPath } from './useBoardPath'
import { useRoadUrl } from './useRoadUrl'

/** Keeps a board's choices on its roadmap (saveChoicesAction, passed down by the layout). */
export type SaveChoices = (id: string, choices: RoadmapChoices) => Promise<ActionResult>
/** Keeps a roadmap's whole set of answers (saveRoadmapAnswersAction). */
export type SaveAnswers = (id: string, answers: StoredAnswers) => Promise<ActionResult>

/** The board's writes, as the layout passes them. */
export type BoardActions = {
  saveChoicesAction: SaveChoices
  saveRoadmapAnswersAction: SaveAnswers
}

/** A toast: what an action did, and what Undo does (none: no Undo). */
export type ToastState = { id: number; text: string; undo: (() => void) | null }

const nameIn = (scene: Scene, id: string) => scene.tiles.find((t) => t.id === id)?.name ?? ''

/** What the English test's "Not taken yet" stores (the opening's question model). */
const NOT_TAKEN = 'Not taken yet'

/** What her answers mark on the road: the badges' words and each tile's marked words. */
const marksOf = (scene: Scene) =>
  JSON.stringify([scene.badges, scene.tiles.map((t) => [t.id, t.kicker, t.costs, t.badges])])

/**
 * What saving her answers says: what moved on the course on her road (the budget's, else the
 * English test's), or that nothing on the road changes.
 */
function answersSaid(
  after: Scene,
  before: StoredAnswers,
  next: StoredAnswers,
  moved: boolean,
): string {
  if (!moved) return 'Saved. Nothing on your roadmap changes.'
  const course = after.tiles.find((t) => t.id === after.courseLine[0])
  const name = course?.name ?? ''
  const amount = next.amount?.value
  if (amount !== before.amount?.value && typeof amount === 'number' && course?.fees !== undefined) {
    const over = Math.round((course.fees - amount) * 10) / 10
    return over > 0
      ? `Budget changed. ${name} now goes AUD ${over}k a year over it.`
      : `Budget changed. ${name} fits your budget.`
  }
  return next.eng?.value === NOT_TAKEN
    ? `English test changed. ${name}’s entry condition is no longer met.`
    : 'Saved. Your roadmap changed.'
}

/**
 * What she does on the board, and where it leaves the URL. The query holds the open tile, the
 * zoom, the view and the stack's list (useRoadUrl); over the lesson or a route step (`panel`), a
 * change to any of them leaves the panel for the board (useBoardPath) with that query. What she
 * changes (swaps, Put on my board, the lesson read, a walk) starts from the roadmap's stored
 * choices, is said in a toast with Undo, and is saved to the roadmap, a change and its Undo alike;
 * a save that fails leaves the change on screen and says so (`saveFailed`) until one succeeds. Her
 * first visit (the server's say) is the first arrival, never saved. Zoom changes, presses and the
 * view are said in `status`, for a polite live region. The list and the lesson opened from the
 * board pushed an entry, so closing them goes back. Her answers (`open=answers`, from the menu or
 * Point A; on a phone, over the Map view) pushed one too: while they are open a press only says
 * to close them, a pick not saved is the scene's preview, and Save writes the roadmap's answers
 * (the board keeps them at once, the server's read follows), said in a toast with Undo when the
 * road moved. On a new roadmap's draft (`draft`) her answers are open from the start and stay
 * open: the draft is the page.
 */
export function useRoadSession(
  road: Road,
  panel: RoadPanel,
  roadmap: BoardRoadmap,
  { saveChoicesAction, saveRoadmapAnswersAction }: BoardActions,
  phone: boolean,
  draft = false,
) {
  const router = useRouter()
  const board = useBoardPath()
  const [session, setSession] = useState<Session>(() =>
    sessionFrom(roadmap.choices, roadmap.firstVisit),
  )
  // Her answers as saved here; a new read from the server replaces them.
  const [answers, setAnswers] = useState(roadmap.answers)
  const [given, setGiven] = useState(roadmap.answers)
  if (given !== roadmap.answers) {
    setGiven(roadmap.answers)
    setAnswers(roadmap.answers)
  }
  const scene = useMemo(() => buildScene(road, session, answers), [road, session, answers])
  const { state, setState } = useRoadUrl(scene.tiles)
  const answering = draft || state.open === 'answers'
  // Her answers closed under the board (Back): what they previewed goes with them.
  if (!answering && session.preview) setSession({ ...session, preview: undefined })
  const [status, setStatus] = useState('')
  const [toast, setToast] = useState<ToastState | null>(null)
  const toasts = useRef(0)
  // What just changed, for the phone's road to scroll to.
  const [changed, setChanged] = useState<RoadFocus | null>(null)
  const listPushed = useRef(false)
  const lessonPushed = useRef(false)
  const answersPushed = useRef(false)
  const [saveFailed, setSaveFailed] = useState(false)

  /** Any press ends the first arrival, and its hint. */
  const settled = session.first ? { ...session, first: false } : session

  // The saves sent so far, one after another.
  const saving = useRef<Promise<void>>(Promise.resolve())

  /**
   * The board has already changed; a failure only says so. Each save waits for the one before, so
   * they land in the order she made them (an Undo never lands before its change) and the last
   * one's answer is the one shown. `saved`: what follows a save that succeeded.
   */
  function write(send: () => Promise<ActionResult>, saved?: () => void) {
    saving.current = saving.current.then(() =>
      send().then(
        (result) => {
          setSaveFailed(!result.ok)
          if (result.ok) saved?.()
        },
        () => setSaveFailed(true),
      ),
    )
  }

  function save(next: Session) {
    const choices = choicesFrom(next)
    write(() => saveChoicesAction(roadmap.id, choices))
  }

  /** A roadmap's answers, then the server's read of them. */
  function saveAnswersOf(next: StoredAnswers) {
    write(
      () => saveRoadmapAnswersAction(roadmap.id, next),
      () => router.refresh(),
    )
  }

  function toastOf(text: string, undo: (() => void) | null) {
    toasts.current += 1
    setToast({ id: toasts.current, text, undo })
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
    const after = buildScene(road, next, answers)
    const before = session
    toastOf(
      text(after),
      undo
        ? () => {
            setSession(before)
            save(before)
          }
        : null,
    )
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
    if (answering) return setStatus('Close your answers to open a tile.')
    if (tileId === POINT_A) return openAnswers()
    setSession(settled)
    const base = settled === session ? scene : buildScene(road, settled, answers)
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
          `${nameIn(after, after.here)} is on your roadmap now. The road ahead re-routed through it.`,
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
        `${nameIn(after, after.alternative)} is on your board, beside your roadmap. ${nameIn(scene, scene.alternative)} folded into the stack.`,
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

  /** Her answers over the board, pushed so Back closes them; on a phone, over the Map view. */
  function openAnswers() {
    if (answering) return
    answersPushed.current = !panel
    go({ ...state, tile: null, open: 'answers', view: phone ? 'map' : state.view })
    setStatus('Your answers')
  }

  function closeAnswers() {
    setSession({ ...session, preview: undefined })
    if (answersPushed.current) {
      answersPushed.current = false
      window.history.back()
    } else go({ ...state, open: null })
  }

  /** Saved here at once and on the roadmap; with Undo when the road moved. */
  function saveAnswers(next: StoredAnswers) {
    const before = answers
    const base = { ...session, preview: undefined }
    const after = buildScene(road, base, next)
    const moved = marksOf(buildScene(road, base, before)) !== marksOf(after)
    setAnswers(next)
    setSession(base)
    toastOf(
      answersSaid(after, before, next, moved),
      moved
        ? () => {
            setAnswers(before)
            saveAnswersOf(before)
          }
        : null,
    )
    saveAnswersOf(next)
  }

  return {
    scene,
    answers,
    answering,
    openAnswers,
    closeAnswers,
    saveAnswers,
    /** What a pick not saved would change, drawn on the map until it is saved or dropped. */
    preview: (prev: Record<string, string>) =>
      setSession({ ...session, preview: Object.keys(prev).length ? prev : undefined }),
    state,
    status,
    toast,
    saveFailed,
    changed,
    press,
    zoom,
    close,
    view,
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
      toast.undo()
      setToast(null)
    },
    dismissToast: () => setToast(null),
    /** A toast that only says something: what is not here yet. */
    say: (text: string) => toastOf(text, null),
  }
}
