'use client'

import { List, Map as MapIcon } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useRouter, useSelectedLayoutSegments } from 'next/navigation'
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FinderProps } from '@/features/finder/client'
import { answerGroups, type RoadChangeOf } from '@/features/opening'
import { RoadmapLoader } from '@/features/roadmaps'
import {
  type CardDetails,
  roadChange,
  type TileAsk as Suggested,
  type TilePost,
} from '@/features/roads/client'
import motion from '@/shared/components/motion.module.css'
import { Note } from '@/shared/components/Note'
import { Toast } from '@/shared/components/Toast'
import { Button } from '@/shared/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/shared/components/ui/sheet'
import { ROADMAPS_PATH, roadmapPath } from '@/shared/lib/student-paths'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import type {
  Pinned,
  Relative,
  RoadmapChoices,
  RoadmapTag,
  StoredAnswers,
} from '@/shared/types/student'
import { BoardPath } from '../hooks/useBoardPath'
import { type BoardActions, useRoadSession } from '../hooks/useRoadSession'
import type { WhyAction } from '../hooks/useTileWhy'
import { type Layout, layoutOf } from '../model/camera'
import type { MatchLine } from '../model/match-line'
import { cardFor, primaryAction, withStart } from '../model/press'
import type { Road } from '../model/road-data'
import type { View } from '../model/road-url'
import { panelAt } from '../model/routes'
import { AnswersPanel } from './AnswersPanel'
import answersStyles from './answers.module.css'
import { BottomSheet } from './BottomSheet'
import { ControlsBar } from './ControlsBar'
import { LessonPanel } from './LessonPanel'
import { Overview } from './Overview'
import { PhoneMap } from './PhoneMap'
import { PhoneRoad } from './PhoneRoad'
import { type CardAsk, type CardWhy, RoadCard } from './RoadCard'
import { RoadHeader } from './RoadHeader'
import { RoadMap } from './RoadMap'
import type { RoadmapLink } from './RoadmapDrawer'
import { RouteDetail } from './RouteDetail'
import { FIND, StackList } from './StackList'
import type { AskAction } from './TileAsk'
import { pinnedDraftPath } from './WhatChanges'

/**
 * The Find panel, in its own chunk: next/dynamic (React.lazy with Suspense) loads it "on demand,
 * only when/if the condition is met" (node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md,
 * "Importing Client Components"), so a board without `finder`, which never renders it, never
 * loads it.
 */
const FinderPanel = dynamic(() => import('@/features/finder/client').then((m) => m.FinderPanel))

/**
 * The board's layout from its own width: phone, stacked or wide (side by side); null until it has
 * measured (the server's HTML, and the first render in the browser).
 */
function useLayout(ref: RefObject<HTMLElement | null>): Layout | null {
  const [layout, setLayout] = useState<Layout | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setLayout(layoutOf(el.clientWidth))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return layout
}

/**
 * The roadmap a board draws: its id, its name (resolved: hers, else from its road), what she did on
 * it, whether she has opened it before, and what Your answers shows: its answers, person and the
 * tags read from her own words (none when absent).
 */
export type BoardRoadmap = {
  id: string
  name: string
  choices: RoadmapChoices
  firstVisit: boolean
  answers: StoredAnswers
  relative: Relative | null
  tags?: RoadmapTag[]
}

/**
 * A new roadmap's draft: the roadmap it copies (null from scratch), the answers it starts with
 * (the source's, or none), and the course it is pinned to, if any; `around` names that course when
 * she chose it to switch to (Start a new roadmap from it), so Create needs no answer changed.
 */
export type BoardDraft = {
  from: { id: string; name: string } | null
  answers: StoredAnswers
  pinned?: Pinned
  around?: string
}

/** Makes the new roadmap (createRoadmapAction), giving its id; without `fromId`, from scratch. */
export type CreateRoadmap = (input: {
  fromId?: string
  answers: StoredAnswers
  pinned?: Pinned
}) => Promise<ActionResult<{ id: string }>>

/** A board's writes; a draft's only the new roadmap. */
type Writes =
  | (BoardActions & { draft?: undefined })
  | { draft: BoardDraft; createRoadmapAction: CreateRoadmap }

/** A draft keeps nothing on the roadmap it copies: no press reaches a save, and none is sent. */
const nothingSaved = async (): Promise<ActionResult> => ({ ok: true })

/**
 * One roadmap's board, at `/roadmaps/<id>`: its lesson and route links and its ways back stay under
 * it. It opens on the roadmap's stored choices, with the first arrival on her first visit, and
 * keeps each change on the roadmap through `saveChoicesAction` and her answers through
 * `saveRoadmapAnswersAction`. With `draft`, it is a
 * new roadmap's, at `/roadmaps/new?from=<id>`: the source's board, drawn only, under its answers in
 * draft mode; at `/roadmaps/new`, from scratch, the empty road under none. Create roadmap makes it
 * (`createRoadmapAction`). `match` is the line under the header when the road is not exactly
 * hers (the closest, or the illustrative one); none, nothing. `rematch`: the road is the one her
 * answers match (the switch is on), so Your answers says when a change would move her to another.
 * `whyAction` writes why a tile her answers decided is on the roadmap; `whyEnabled` lets the cards
 * ask it (the road is the one her answers match, or the closest); without, they show the template.
 * `askAction` answers her questions about a city or course tile, and `asks` holds each such tile's
 * suggested questions by tile id; a card offers its suggested questions with `asks`, and takes her
 * own only with `askAction` too (the layout passes them on the same roads as the why, and no
 * action while the student AI is off). `details`: each tile's catalogue facts, by tile id.
 * `tilePosts`: the posts and updates about each tile, by tile id, that its card lists.
 * `finder`: Find courses (the box's first words and its two actions) when the finder is on; none
 * on a draft. Without it nothing on the board offers to find courses. `roadmaps`: her roadmaps, to
 * switch to from the header's drawer; none on a draft.
 */
export function RoadBoard({
  road,
  roadmap,
  match,
  rematch = false,
  whyAction,
  whyEnabled = false,
  askAction,
  asks,
  details,
  tilePosts,
  finder,
  roadmaps,
  children,
  ...writes
}: Writes & {
  road: Road
  roadmap: BoardRoadmap
  match?: MatchLine | null
  rematch?: boolean
  whyAction?: WhyAction
  whyEnabled?: boolean
  askAction?: AskAction
  asks?: Record<string, Suggested[]>
  details?: Record<string, CardDetails>
  tilePosts?: Record<string, TilePost[]>
  finder?: FinderProps
  roadmaps?: RoadmapLink[]
  children: ReactNode
}) {
  const actions: BoardActions = writes.draft
    ? { saveChoicesAction: nothingSaved, saveRoadmapAnswersAction: nothingSaved }
    : writes
  return (
    <BoardPath value={roadmapPath(roadmap.id)}>
      <Board
        road={road}
        roadmap={writes.draft ? { ...roadmap, answers: writes.draft.answers } : roadmap}
        actions={actions}
        draft={writes.draft ? { ...writes.draft, create: writes.createRoadmapAction } : null}
        match={match ?? null}
        rematch={rematch}
        whyAction={whyAction}
        whyEnabled={whyEnabled}
        askAction={askAction}
        asks={asks}
        details={details ?? {}}
        tilePosts={tilePosts}
        finder={writes.draft ? undefined : finder}
        roadmaps={writes.draft ? undefined : roadmaps}
      >
        {children}
      </Board>
    </BoardPath>
  )
}

/**
 * "Your roadmap": rendered once by the roadmap's layout, so it stays mounted (the camera, the
 * session) across the board, its lesson and its route steps; the route says what the card column
 * shows (`<board>/learn/<lesson>`, `<board>/route/<route-id>`, else the query's card). The header;
 * the map and the card column side by side from 64rem, or stacked below it (map, card, then the
 * controls bar). Below 36rem, a phone: the Road / Map switch (`view`), the road as a list or the
 * map with its peek, and what the card column shows rises as a bottom sheet. What she does on the
 * board, and the URL it leaves, are useRoadSession's. Until it has measured its width the board is
 * drawn but not shown, so a phone never paints the wide layout first (the map cannot draw before
 * it measures either). Her answers open over it: in the card column, whose size never changes, so
 * neither does the map's; on a phone, in a sheet over the map's lower part with no scrim, the map
 * above it the preview. On a draft they are
 * open from the start, in draft mode: Create runs the loader, whose first step makes the roadmap,
 * and lands on the new roadmap's board; Cancel and Close only close them, leaving her on the
 * draft's board, and Your answers opens them again. Find courses (`finder`)
 * opens where her answers open, from the course stack's list only; her answers opening closes it,
 * and closing Find gives the column back to what it showed.
 */
function Board({
  road,
  roadmap,
  actions,
  draft,
  match,
  rematch,
  whyAction,
  whyEnabled,
  askAction,
  asks,
  details,
  tilePosts,
  finder,
  roadmaps,
  children,
}: {
  road: Road
  roadmap: BoardRoadmap
  actions: BoardActions
  draft: (BoardDraft & { create: CreateRoadmap }) | null
  match: MatchLine | null
  rematch: boolean
  whyAction: WhyAction | undefined
  whyEnabled: boolean
  askAction: AskAction | undefined
  asks: Record<string, Suggested[]> | undefined
  details: Record<string, CardDetails>
  tilePosts: Record<string, TilePost[]> | undefined
  finder: FinderProps | undefined
  roadmaps: RoadmapLink[] | undefined
  children: ReactNode
}) {
  const router = useRouter()
  // Over the board, the lesson or a route step: read from the route as it renders, so a deep link's
  // first HTML already shows it.
  const panel = panelAt(road, useSelectedLayoutSegments())
  const rootRef = useRef<HTMLDivElement>(null)
  const measured = useLayout(rootRef)
  const layout = measured ?? 'wide'
  const phone = layout === 'phone'
  const {
    scene,
    answers,
    answering,
    openAnswers,
    closeAnswers,
    saveAnswers,
    preview,
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
    startNew,
    morph,
    traded,
    closeList,
    put,
    leaveLesson,
    read,
    leaveRoute,
    onLesson,
    undo,
    dismissToast,
  } = useRoadSession(road, panel, roadmap, actions, phone, draft !== null)
  // Her answers' rows for a set of answers: the panel asks for them with its picks merged in.
  const groupsFor = (given: StoredAnswers) => answerGroups(given, roadmap.relative)
  // With the road her answers match drawn, the rule that says when a pick would move her to
  // another: the roads' keys only, never their copy (the road itself comes from the server).
  const roadChangeOf: RoadChangeOf | undefined = rematch
    ? (before, after) => roadChange(before, after, roadmap.relative)
    : undefined
  // The map's key strip: shown on her first visit, then as Map key says.
  const [keyShown, setKeyShown] = useState(roadmap.firstVisit)
  // On a phone, a draft's answers are over the map, as Your answers opens them.
  const phoneView = draft ? 'map' : state.view

  // Find courses, opened from the course stack's list only, over the column (or in a sheet on a
  // phone). Her answers opening, however they open (a button, Point A, Forward), close it; a tile
  // pressed on the map or the road closes it for that tile's card.
  const [finding, setFinding] = useState(false)
  const [wasAnswering, setWasAnswering] = useState(answering)
  if (answering !== wasAnswering) {
    setWasAnswering(answering)
    if (answering) setFinding(false)
  }
  // Focus: the panel takes it into its box; Close gives it back to the list's Find, drawn afresh.
  const refocus = useRef(false)
  const openFind = finder ? () => setFinding(true) : undefined
  const closeFind = () => {
    refocus.current = true
    setFinding(false)
  }
  useEffect(() => {
    if (finding || !refocus.current) return
    refocus.current = false
    const find = [...(rootRef.current?.querySelectorAll<HTMLElement>('button') ?? [])].find(
      (b) => b.textContent?.trim() === FIND,
    )
    find?.focus()
  }, [finding])
  const pressTile = (tileId: string) => {
    setFinding(false)
    press(tileId)
  }

  // Create roadmap: the answers it is made with, while the loader runs; the id it was given.
  const [creating, setCreating] = useState<StoredAnswers | null>(null)
  const madeId = useRef<string | null>(null)
  const work = [
    async () => {
      if (!draft || !creating) return
      const result = await draft.create({
        ...(draft.from && { fromId: draft.from.id }),
        answers: creating,
        ...(draft.pinned && { pinned: draft.pinned }),
      })
      if (!result.ok) throw new Error(result.error)
      madeId.current = result.id
    },
    // Real generation goes here; the mock road has nothing to draw.
    () => Promise.resolve(),
    // The list renders fresh when she lands on it.
    () => Promise.resolve(),
  ]
  // Create lands on the new roadmap's own board (its first open shows the key strip); the list
  // still marks it New until then.
  const arrive = () => router.replace(madeId.current ? roadmapPath(madeId.current) : ROADMAPS_PATH)

  // With compare on, a course or city she could switch to starts a new roadmap around it in place
  // of a swap: the new road redraws its visa, work rights and jobs, which a swap cannot. A course
  // beside the study step can only start one: without compare's pin it has no primary.
  const compared = state.tile ? details[state.tile]?.compare : undefined
  const startHref = compared?.pin ? pinnedDraftPath(compared.roadmapId, compared.pin) : null
  const card = withStart(cardFor(road, scene, state.tile), startHref !== null)
  const why: CardWhy = {
    roadmapId: roadmap.id,
    answers: roadmap.answers,
    tileId: card.kind === 'here' ? scene.here : (state.tile ?? scene.here),
    action: whyAction,
    enabled: whyEnabled,
  }
  // A card takes questions when its tile is a city or course with suggested questions; her own
  // only with `askAction` (none while the student AI is off).
  const askOn = (tileId: string): CardAsk | undefined => {
    const suggested = asks?.[tileId]
    return suggested
      ? { roadmapId: roadmap.id, tileId, asks: suggested, action: askAction }
      : undefined
  }
  const posts = tilePosts?.[why.tileId]
  const stack = scene.tiles.find((t) => t.id === state.tile && t.kind === 'stack')
  const list = !!stack && state.open === 'list'
  const lesson = panel?.kind === 'lesson' ? panel.lesson : null
  // At Whole road the column is the overview until she presses a tile: then that tile's card.
  const overviewShown = state.zoom === 'whole' && !state.tile
  const columnLabel = finding
    ? 'Find courses'
    : answering
      ? 'Your answers'
      : lesson
        ? 'Lesson'
        : panel?.kind === 'route'
          ? 'Route detail'
          : list
            ? 'Stack'
            : overviewShown
              ? 'Overview'
              : card.kind === 'here'
                ? 'Where you are'
                : 'The tile you pressed'

  const onPrimary = startHref
    ? () => startNew(startHref, compared?.next)
    : primaryAction(road, scene, state.tile)
      ? primary
      : undefined
  const stackList = stack ? (
    <StackList
      stack={stack}
      rows={road.stackRows}
      onBoard={scene.tiles.map((t) => t.id)}
      onClose={closeList}
      onPut={put}
      onFind={openFind}
    />
  ) : null
  const lessonPanel = lesson ? (
    <LessonPanel lesson={lesson} onDone={read} onLater={leaveLesson} />
  ) : null
  const overview = <Overview overview={road.overview} onBack={() => zoom('level')} />

  const answersPanel = (place: 'column' | 'sheet') =>
    draft ? (
      <AnswersPanel
        mode="draft"
        copyOf={draft.from?.name ?? null}
        around={draft.around}
        groupsFor={groupsFor}
        answers={answers}
        road={road}
        place={place}
        onPreview={preview}
        onCreate={setCreating}
        onCancel={closeAnswers}
      />
    ) : (
      <AnswersPanel
        groupsFor={groupsFor}
        answers={answers}
        road={road}
        place={place}
        onPreview={preview}
        tags={roadmap.tags}
        rematch={roadChangeOf}
        onSave={saveAnswers}
        onClose={closeAnswers}
      />
    )

  const finderPanel = finder ? (
    <FinderPanel roadmapId={roadmap.id} {...finder} onClose={closeFind} />
  ) : null

  function column() {
    if (finding) return finderPanel
    if (answering) return answersPanel('column')
    if (lessonPanel) return lessonPanel
    if (panel?.kind === 'route')
      return (
        <RouteDetail step={panel.step} road={road} scene={scene} details={details[panel.step.id]} />
      )
    if (list) return stackList
    if (overviewShown) return overview
    return (
      <RoadCard
        stickyActions
        key={state.tile ?? scene.here}
        road={road}
        scene={scene}
        card={card}
        onOpen={press}
        onClose={close}
        onPrimary={onPrimary}
        onLesson={onLesson}
        why={why}
        ask={askOn(why.tileId)}
        details={details[why.tileId]}
        posts={posts}
      />
    )
  }

  /**
   * On a phone, what the card column would show rises as a sheet; the map's own card is its peek.
   * One sheet, always mounted: this picks what it shows, or null to let it slide away.
   */
  function sheet(): { label: string; onClose: () => void; body: ReactNode } | null {
    if (!phone || answering || finding) return null
    if (lesson) return { label: lesson.title, onClose: leaveLesson, body: lessonPanel }
    if (panel?.kind === 'route')
      return {
        label: panel.step.name,
        onClose: leaveRoute,
        body: (
          <RouteDetail
            step={panel.step}
            road={road}
            scene={scene}
            details={details[panel.step.id]}
          />
        ),
      }
    if (stack && list) return { label: stack.name, onClose: closeList, body: stackList }
    if (state.view === 'map' && overviewShown)
      return { label: 'Overview', onClose: () => zoom('level'), body: overview }
    if (state.view === 'road' && card.kind !== 'here')
      return {
        label: card.name,
        onClose: close,
        body: (
          <RoadCard
            key={state.tile}
            road={road}
            scene={scene}
            card={card}
            onOpen={press}
            onClose={close}
            onPrimary={onPrimary}
            onLesson={onLesson}
            why={why}
            ask={askOn(why.tileId)}
            details={details[why.tileId]}
            posts={posts}
          />
        ),
      }
    return null
  }

  /**
   * The toast over the map or the phone's road; with it, while a change is not saved, the note
   * that says so, where the first arrival's hint sat (gone once she has changed anything).
   */
  const toastEl = (place?: string) => (
    <>
      {toast ? (
        <Toast
          key={toast.id}
          text={toast.text}
          place={place}
          onUndo={toast.undo ? undo : undefined}
          onDone={dismissToast}
        />
      ) : null}
      {saveFailed ? (
        <div className="pointer-events-none absolute inset-x-4 top-4 z-40 flex justify-center @max-xl:top-18">
          <Note tone="limit" appear role="alert" className="pointer-events-auto shadow-lg">
            We couldn't save that change.
          </Note>
        </div>
      ) : null}
    </>
  )

  const mapProps = {
    road,
    scene,
    state,
    layout,
    onPress: pressTile,
    onZoom: zoom,
    onLesson,
    keyShown,
    onKeyShown: setKeyShown,
    answering,
    match,
    morph,
    traded,
  }

  const phoneSheet = sheet()

  return (
    <div ref={rootRef} className={cn(motion.page, '@container relative h-dvh')}>
      <div
        className={cn(
          'mx-auto flex h-full min-h-144 max-w-cap flex-col overflow-hidden',
          measured === null && 'invisible',
        )}
      >
        <RoadHeader
          roadmapName={draft ? 'New roadmap' : roadmap.name}
          onAnswers={openAnswers}
          switchTo={roadmaps && { openId: roadmap.id, roadmaps }}
        />
        {phone ? (
          <>
            {answering ? null : <ViewSwitch view={state.view} onView={view} />}
            <div className="relative grid min-h-0 flex-1">
              {phoneView === 'map' ? (
                <PhoneMap {...mapProps} card={card} onClose={close} onPrimary={onPrimary} />
              ) : (
                <PhoneRoad
                  road={road}
                  scene={scene}
                  card={cardFor(road, scene, null)}
                  tile={state.tile}
                  changed={changed}
                  onOpen={pressTile}
                  onClose={close}
                  onPrimary={primaryAction(road, scene, null) ? primary : undefined}
                  onLesson={onLesson}
                  why={{ ...why, tileId: scene.here }}
                  ask={askOn(scene.here)}
                  details={details[scene.here]}
                  posts={tilePosts?.[scene.here]}
                />
              )}
              {toastEl(
                answering || finding ? 'top-14' : phoneView === 'map' ? 'bottom-56' : 'bottom-4',
              )}
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 @max-5xl:flex-col">
            <RoadMap {...mapProps}>{toastEl()}</RoadMap>
            {/* One width (stacked, one height) in every state, the one her answers need: the map
                never resizes. */}
            <aside
              aria-label={columnLabel}
              className="relative z-30 flex min-h-0 w-md shrink-0 flex-col gap-4 overflow-auto border-l bg-background p-6 @max-5xl:h-1/2 @max-5xl:w-auto @max-5xl:border-t @max-5xl:border-l-0 @max-5xl:py-5"
            >
              {column()}
            </aside>
          </div>
        )}
        <ControlsBar weights={road.weights} onAnswers={openAnswers} />
      </div>
      <BottomSheet
        open={phoneSheet !== null}
        label={phoneSheet?.label ?? ''}
        onClose={phoneSheet?.onClose ?? close}
      >
        {phoneSheet?.body}
      </BottomSheet>
      {/* Her answers on a phone: modeless, so the map above stays live; Escape is the panel's. */}
      <Sheet open={phone && answering && !finding} modal={false}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          aria-describedby={undefined}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className={cn(
            answersStyles.sheet,
            'flex flex-col gap-4 overflow-auto px-4 pt-3 pb-0 text-foreground',
          )}
        >
          <span aria-hidden="true" className="h-1 w-10 shrink-0 self-center bg-neutral-400" />
          <SheetTitle className="sr-only">Your answers</SheetTitle>
          {phone && answering && !finding ? answersPanel('sheet') : null}
        </SheetContent>
      </Sheet>
      {/* Find courses on a phone: modeless too, as her answers open. */}
      {finderPanel ? (
        <Sheet open={phone && finding} modal={false}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            aria-describedby={undefined}
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
            className={cn(
              answersStyles.sheet,
              'flex flex-col gap-4 overflow-auto px-4 pt-3 pb-4 text-foreground',
            )}
          >
            <span aria-hidden="true" className="h-1 w-10 shrink-0 self-center bg-neutral-400" />
            <SheetTitle className="sr-only">Find courses</SheetTitle>
            {phone && finding ? finderPanel : null}
          </SheetContent>
        </Sheet>
      ) : null}
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
      {children}
      {creating ? <RoadmapLoader kind="new" draft work={work} onDone={arrive} /> : null}
    </div>
  )
}

const SEGMENT =
  'h-11 gap-1.5 rounded-none border-0 px-4 font-sans font-medium aria-pressed:bg-brand aria-pressed:text-brand-foreground aria-pressed:hover:bg-brand-hover'

/** The phone's switch: her road as a list (Road) or the map (Map); the one showing is pressed. */
function ViewSwitch({ view, onView }: { view: View; onView: (view: View) => void }) {
  return (
    <div className="flex items-center border-b bg-background px-4 py-2">
      <fieldset aria-label="Show your roadmap as" className="m-0 flex min-w-0 border p-0">
        <Button
          type="button"
          variant="square"
          aria-pressed={view === 'road'}
          onClick={() => onView('road')}
          className={SEGMENT}
        >
          <List aria-hidden="true" strokeWidth={1.5} className="size-icon-sm" />
          Road
        </Button>
        <Button
          type="button"
          variant="square"
          aria-pressed={view === 'map'}
          onClick={() => onView('map')}
          className={cn(SEGMENT, 'border-l')}
        >
          <MapIcon aria-hidden="true" strokeWidth={1.5} className="size-icon-sm" />
          Map
        </Button>
      </fieldset>
    </div>
  )
}
