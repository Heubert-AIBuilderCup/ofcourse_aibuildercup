'use client'

import { List, Map as MapIcon } from 'lucide-react'
import Link from 'next/link'
import { useSelectedLayoutSegments } from 'next/navigation'
import { type ReactNode, type RefObject, useLayoutEffect, useRef, useState } from 'react'
import motion from '@/shared/components/motion.module.css'
import { Note } from '@/shared/components/Note'
import { Toast } from '@/shared/components/Toast'
import { Button, buttonVariants } from '@/shared/components/ui/button'
import { roadmapPath } from '@/shared/lib/student-paths'
import { cn } from '@/shared/lib/utils'
import type { RoadmapChoices } from '@/shared/types/student'
import { BoardPath, useBoardPath } from '../hooks/useBoardPath'
import { type SaveChoices, useRoadSession } from '../hooks/useRoadSession'
import { type Layout, layoutOf } from '../model/camera'
import { cardFor, primaryAction } from '../model/press'
import type { Road, Tile } from '../model/road-data'
import type { View } from '../model/road-url'
import { panelAt } from '../model/routes'
import { BottomSheet } from './BottomSheet'
import { ControlsBar } from './ControlsBar'
import { LessonPanel } from './LessonPanel'
import { Overview } from './Overview'
import { PhoneMap } from './PhoneMap'
import { PhoneRoad } from './PhoneRoad'
import { RoadCard } from './RoadCard'
import { RoadHeader } from './RoadHeader'
import { RoadMap } from './RoadMap'
import { StackList } from './StackList'

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
 * it, and whether she has opened it before.
 */
export type BoardRoadmap = {
  id: string
  name: string
  choices: RoadmapChoices
  firstVisit: boolean
}

/**
 * One roadmap's board, at `/roadmaps/<id>`: its lesson and route links and its ways back stay under
 * it. It opens on the roadmap's stored choices, with the first arrival on her first visit, and
 * keeps each change on the roadmap through `saveChoicesAction`.
 */
export function RoadBoard({
  road,
  roadmap,
  saveChoicesAction,
  children,
}: {
  road: Road
  roadmap: BoardRoadmap
  saveChoicesAction: SaveChoices
  children: ReactNode
}) {
  return (
    <BoardPath value={roadmapPath(roadmap.id)}>
      <Board road={road} roadmap={roadmap} saveChoicesAction={saveChoicesAction}>
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
 * it measures either).
 */
function Board({
  road,
  roadmap,
  saveChoicesAction,
  children,
}: {
  road: Road
  roadmap: BoardRoadmap
  saveChoicesAction: SaveChoices
  children: ReactNode
}) {
  // Over the board, the lesson or a route step: read from the route as it renders, so a deep link's
  // first HTML already shows it.
  const panel = panelAt(road, useSelectedLayoutSegments())
  const {
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
    primary,
    closeList,
    put,
    leaveLesson,
    read,
    leaveRoute,
    onLesson,
    undo,
    dismissToast,
    say,
  } = useRoadSession(road, panel, roadmap, saveChoicesAction)
  const rootRef = useRef<HTMLDivElement>(null)
  const measured = useLayout(rootRef)
  const layout = measured ?? 'wide'
  const phone = layout === 'phone'
  // The map's key strip: shown on her first visit, then as Map key says.
  const [keyShown, setKeyShown] = useState(roadmap.firstVisit)
  const onLater = () => say('Ask and Compare come in a later round.')

  const card = cardFor(road, scene, state.tile)
  const stack = scene.tiles.find((t) => t.id === state.tile && t.kind === 'stack')
  const list = !!stack && state.open === 'list'
  const lesson = panel?.kind === 'lesson' ? panel.lesson : null
  const columnLabel = lesson
    ? 'Lesson'
    : panel?.kind === 'route'
      ? 'Route detail'
      : list
        ? 'Stack'
        : state.zoom === 'whole'
          ? 'Overview'
          : card.kind === 'here'
            ? 'Where you are'
            : 'The tile you pressed'

  const onPrimary = primaryAction(road, scene, state.tile) ? primary : undefined
  const stackList = stack ? (
    <StackList
      stack={stack}
      rows={road.stackRows}
      onBoard={scene.tiles.map((t) => t.id)}
      onClose={closeList}
      onPut={put}
    />
  ) : null
  const lessonPanel = lesson ? (
    <LessonPanel lesson={lesson} onDone={read} onLater={leaveLesson} />
  ) : null
  const overview = <Overview overview={road.overview} onBack={() => zoom('level')} />

  function column() {
    if (lessonPanel) return lessonPanel
    if (panel?.kind === 'route') return <RouteCard step={panel.step} />
    if (list) return stackList
    if (state.zoom === 'whole') return overview
    return (
      <RoadCard
        key={state.tile ?? scene.here}
        road={road}
        scene={scene}
        card={card}
        onOpen={press}
        onClose={close}
        onPrimary={onPrimary}
        onLesson={onLesson}
      />
    )
  }

  /**
   * On a phone, what the card column would show rises as a sheet; the map's own card is its peek.
   * One sheet, always mounted: this picks what it shows, or null to let it slide away.
   */
  function sheet(): { label: string; onClose: () => void; body: ReactNode } | null {
    if (!phone) return null
    if (lesson) return { label: lesson.title, onClose: leaveLesson, body: lessonPanel }
    if (panel?.kind === 'route')
      return {
        label: panel.step.name,
        onClose: leaveRoute,
        body: <RouteCard step={panel.step} />,
      }
    if (stack && list) return { label: stack.name, onClose: closeList, body: stackList }
    if (state.view === 'map' && state.zoom === 'whole')
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
    onPress: press,
    onZoom: zoom,
    onLesson,
    keyShown,
    onKeyShown: setKeyShown,
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
        <RoadHeader roadmapName={roadmap.name} onLater={onLater} />
        {phone ? (
          <>
            <ViewSwitch view={state.view} onView={view} />
            <div className="relative grid min-h-0 flex-1">
              {state.view === 'map' ? (
                <PhoneMap {...mapProps} card={card} onClose={close} onPrimary={onPrimary} />
              ) : (
                <PhoneRoad
                  road={road}
                  scene={scene}
                  card={cardFor(road, scene, null)}
                  tile={state.tile}
                  changed={changed}
                  onOpen={press}
                  onClose={close}
                  onPrimary={primaryAction(road, scene, null) ? primary : undefined}
                  onLesson={onLesson}
                />
              )}
              {toastEl(state.view === 'map' ? 'bottom-56' : 'bottom-4')}
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 @max-5xl:flex-col">
            <RoadMap {...mapProps}>{toastEl()}</RoadMap>
            <aside
              aria-label={columnLabel}
              className="relative z-30 flex min-h-0 w-95 shrink-0 flex-col gap-4 overflow-auto border-l bg-background p-6 @max-5xl:h-88 @max-5xl:w-auto @max-5xl:border-t @max-5xl:border-l-0 @max-5xl:py-5"
            >
              {column()}
            </aside>
          </div>
        )}
        <ControlsBar weights={road.weights} onLater={onLater} />
      </div>
      <BottomSheet
        open={phoneSheet !== null}
        label={phoneSheet?.label ?? ''}
        onClose={phoneSheet?.onClose ?? close}
      >
        {phoneSheet?.body}
      </BottomSheet>
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
      {children}
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

/** A route step's detail: its screen comes next round, a placeholder until then. */
function RouteCard({ step }: { step: Tile }) {
  const board = useBoardPath()
  return (
    <section aria-label={step.name} className="flex max-w-prose flex-col gap-2">
      <h2 className="m-0 text-h3">{step.name}</h2>
      <p className="m-0 text-muted-foreground">Route detail comes in the next round.</p>
      <Link href={board} className={cn(buttonVariants({ variant: 'text' }), 'self-start')}>
        Back to your roadmap
      </Link>
    </section>
  )
}
